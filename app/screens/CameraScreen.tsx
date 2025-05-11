// screens/CameraScreen.tsx
import { useState, useRef, useEffect } from 'react';
import { View, Button, Text, StyleSheet } from 'react-native';
import { Camera, CameraViewRef, CameraView } from 'expo-camera';
import { useBluetooth } from '../services/useBLE';

import * as TextRecognition from 'expo-text-recognition';
import * as ImageManipulator from 'expo-image-manipulator';

import { GestureDetector, Gesture, GestureHandlerRootView, Directions } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

export default function CameraScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [classification, setClassification] = useState<'ramp' | 'non-ramp' | null>(null);

  const [showCamera, setShowCamera] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  // Bluetooth hook
  const { connectToDevice, sendCommand, connected, device } = useBluetooth();
  
  useEffect(() => {
    // Request camera permission
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      console.log('Camera permission status:', status);
      setHasPermission(status === 'granted');
    })();
  }, []);

  useEffect(() => {

    if (!connected) setShowCamera(connected)
    else {
      const timer = setTimeout(() => {
        console.log("set showCamera to true")
        setShowCamera(true);
      }, 1000);
  
      return () => clearTimeout(timer);
    }
  }, [connected]);

  const handleGesture = (direction: 'ramp' | 'non-ramp') => {
    if (direction === 'ramp') console.log('Swiped left → Ramp');
    else console.log('Swiped right → Non-ramp');
  
    setClassification(direction);
    sendCommand(direction === 'ramp' ? 'RAMP' : 'NONRAMP');
  };
  
  const swipeLeft = Gesture.Fling()
    .direction(Directions.LEFT)
    .onEnd(() => runOnJS(handleGesture)('ramp'));
  
  const swipeRight = Gesture.Fling()
    .direction(Directions.RIGHT)
    .onEnd(() => runOnJS(handleGesture)('non-ramp'));

  async function cropTopLeft(imageUri: string): Promise<string> {
    const cropped = await ImageManipulator.manipulateAsync(
      imageUri,
      [{
        crop: {
          originX: 0,
          originY: 0,
          width: 800,     // Adjust based on your image size
          height: 200     // Target the top name area
        }
      }],
      { compress: 1, format: ImageManipulator.SaveFormat.PNG }
    );
    return cropped.uri;
  }

  async function extractCardName(imageUri: string): Promise<string | null> {
    const croppedUri = await cropTopLeft(imageUri);
    const result = await TextRecognition.getTextFromFrame(croppedUri);
    if (!result || result.length === 0) return null;
  
    const lines = result.map(line => line.trim()).filter(Boolean);
    return lines[0] || null;
  }  

  

  async function queryCard(name: string): Promise<'ramp' | 'non-ramp'> {
    try {
      //const response: any = await API.graphql(graphqlOperation(getCardByName, { name }));
      const isRamp = true // response.data.getCardByName?.isRamp;
      return isRamp ? 'ramp' : 'non-ramp';
    } catch (error) {
      console.error('Error querying card:', error);
      return 'non-ramp';
    }
  }

  const takePicture = async () => {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({});
    if (!photo) return;
  
    const cardName = await extractCardName(photo.uri);
    if (!cardName) {
      console.warn('Card name not detected');
      setClassification('non-ramp');
      sendCommand('NONRAMP');
      return;
    }

    async function extractCardName(imageUri: string): Promise<string | null> {
      const croppedUri = await cropTopLeft(imageUri);
      const result = await TextRecognition.getTextFromFrame(croppedUri);
      if (!result || result.length === 0) return null;
    
      const lines = result.map(line => line.trim()).filter(Boolean);
      return lines[0] || null;
    }
  
    const classificationResult = await queryCard(cardName);
    setClassification(classificationResult);
  
    sendCommand(classificationResult === 'ramp' ? 'RAMP' : 'NONRAMP');
  };

  if (hasPermission === null) {
    return <View className="flex-1 bg-black" />;
  }

  if (hasPermission === false) {
    return (
      <View className="flex-1 justify-center items-center">
        <Button title="Camera permission not granted" onPress={() => {}} />
      </View>
    );
  }

  if (connected && device) {
    // Fullscreen swipe mode with camera
    return (
      <View style={{ flex: 1, opacity: 1 }}>
        <GestureDetector gesture={Gesture.Exclusive(swipeLeft, swipeRight)}>
        { showCamera && hasPermission ? (  
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={false}
          />
        ) : <View style={StyleSheet.absoluteFillObject && { backgroundColor: "purple" }} />}
        </GestureDetector>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <CameraView
        ref={cameraRef}
        className="flex-1"
        facing="back"
        enableTorch={false}
      />
      <Button title="Scan Card" onPress={takePicture} />
      
      {connected && device ? (
        <Text className="text-center mt-4 text-lg">Connected to {device.name}</Text>
      ) : (
        <Button title="Connect to ESP32" onPress={connectToDevice} />
      )}

      {classification && (
        <Text className="text-center mt-4 text-lg">
          Card classified as: {classification === 'ramp' ? 'Mana Ramp' : 'Non-Ramp'}
        </Text>
      )}
    </View>
  );
}
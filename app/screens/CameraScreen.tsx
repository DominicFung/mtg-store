// screens/CameraScreen.tsx
import { useState, useRef, useEffect } from 'react';
import { View, Button, Text } from 'react-native';
import { Camera, CameraViewRef, CameraView } from 'expo-camera';
import { useBluetooth } from '../services/useBLE';
import { classifyCard } from '../services/classifyCard';

export default function CameraScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [classification, setClassification] = useState<'ramp' | 'non-ramp' | null>(null);
  const cameraRef = useRef<CameraView>(null);

  // Bluetooth hook
  const { connectToDevice, sendCommand, connected, device } = useBluetooth();

  useEffect(() => {
    // Request camera permission
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const takePicture = async () => {
    if (!cameraRef.current) return
    const photo = await cameraRef.current.takePictureAsync({})
    
    if (!photo) return
    const classificationResult = await classifyCard(photo.uri);
    setClassification(classificationResult);
    
    // Send Bluetooth command based on classification
    if (classificationResult === 'ramp') {
      sendCommand('RAMP');
    } else {
      sendCommand('NONRAMP');
    }
  }

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

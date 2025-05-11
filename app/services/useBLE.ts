import { BleManager, Device } from 'react-native-ble-plx';
import { useEffect, useState } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import { Buffer } from 'buffer';

const bleManager = new BleManager();

export function useBluetooth() {
  const [connected, setConnected] = useState(false);
  const [device, setDevice] = useState<Device | null>(null);

  useEffect(() => {
    return () => {
      bleManager.destroy();
    };
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
    }
  };

  const connectToDevice = async () => {
    console.log("Connect to Devices ...")
    await requestPermissions();
    bleManager.startDeviceScan(null, null, (error, scannedDevice) => {
      if (error) {
        console.error('Scan error', error);
        return;
      }

      console.log("Listing all devices.")
      if (scannedDevice && scannedDevice.name) {
        console.log("Devices found, may be unrelated:")
        console.debug('Found Unrelated Device:', scannedDevice.name);
      } else {
        console.log(`No Scanned devices found.`)
      }

      if (scannedDevice?.name?.includes('TheManaRamp')) {
        console.log('Found device:', scannedDevice.name);
        bleManager.stopDeviceScan();

        scannedDevice.connect()
          .then((connectedDevice) => {
            console.log('Connected to', connectedDevice.name);
            setDevice(connectedDevice);
            setConnected(true);
          })
          .catch((connectError) => {
            console.error('Connection error', connectError);
          });
      }
    });
  };

  const sendCommand = async (command: string) => {
    if (!device) {
      console.warn('No device connected.');
      return;
    }
  
    await device.discoverAllServicesAndCharacteristics();
    const services = await device.services();
    const service = services[0];
    const characteristics = await service.characteristics();
    const characteristic = characteristics[0];
  
    // Encode the command as base64
    const base64Command = Buffer.from(command, 'utf-8').toString('base64');
  
    if (characteristic.isWritableWithResponse) {
      await characteristic.writeWithResponse(base64Command);
    } else if (characteristic.isWritableWithoutResponse) {
      await characteristic.writeWithoutResponse(base64Command);
    } else {
      console.warn('Characteristic is not writable');
    }
  };

  return {
    connectToDevice,
    sendCommand,
    connected,
    device,
  };
}

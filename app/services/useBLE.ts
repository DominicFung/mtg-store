import { BleManager, Device } from 'react-native-ble-plx';
import { useEffect, useState } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';

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
    await requestPermissions();
    bleManager.startDeviceScan(null, null, (error, scannedDevice) => {
      if (error) {
        console.error('Scan error', error);
        return;
      }

      if (scannedDevice?.name?.includes('ManaESP')) {
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

    if (characteristic.isWritableWithResponse) {
      await characteristic.writeWithResponse(command);
    } else if (characteristic.isWritableWithoutResponse) {
      await characteristic.writeWithoutResponse(command);
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

import { GestureHandlerRootView } from 'react-native-gesture-handler';
import CameraScreen from './screens/CameraScreen';

export default function App() {
  return <GestureHandlerRootView style={{ flex: 1, opacity: 1 }}>
    <CameraScreen />
    </GestureHandlerRootView>
}


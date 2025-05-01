import { View, Text, Image } from 'react-native';

type Props = {
  uri: string;
  classification: 'ramp' | 'non-ramp';
};

export default function CardResult({ uri, classification }: Props) {
  return (
    <View className="p-4">
      <Image source={{ uri }} className="w-full h-48 rounded-lg" resizeMode="contain" />
      <Text className="mt-2 text-center text-lg font-bold">
        {classification === 'ramp' ? 'Mana Ramp Card' : 'Non-Ramp Card'}
      </Text>
    </View>
  );
}
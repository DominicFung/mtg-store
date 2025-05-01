import { TouchableOpacity, Text } from 'react-native';

type Props = {
  title: string;
  onPress: () => void;
};

export default function ManaButton({ title, onPress }: Props) {
  return (
    <TouchableOpacity
      className="bg-green-600 rounded-xl p-4 m-4"
      onPress={onPress}
    >
      <Text className="text-white text-center font-bold text-lg">{title}</Text>
    </TouchableOpacity>
  );
}

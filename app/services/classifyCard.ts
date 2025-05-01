// Mock function to classify a card image
export async function classifyCard(imageUri: string): Promise<'ramp' | 'non-ramp'> {
  // TODO: Call real model or API
  // For now, random result for demo
  return Math.random() > 0.5 ? 'ramp' : 'non-ramp';
}
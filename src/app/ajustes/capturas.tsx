import { Stack } from 'expo-router';

import { CaptureTray } from '@/ui/capture/capture-tray';

export default function CapturasRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Capturas' }} />
      <CaptureTray />
    </>
  );
}

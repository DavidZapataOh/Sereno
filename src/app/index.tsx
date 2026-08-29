import { StyleSheet, Text, View } from 'react-native';

export default function IndexScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sereno</Text>
      <Text style={styles.subtitle}>Fundaciones</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { fontSize: 32, fontWeight: '700' },
  subtitle: { fontSize: 14, opacity: 0.6 },
});

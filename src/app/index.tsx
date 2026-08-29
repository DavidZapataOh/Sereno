import { Link } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { PORTALS } from '@/domain/portals/registry';

export default function SelectorRoute() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sereno</Text>
      <Text style={styles.subtitle}>Captura bancaria — sprint 01</Text>

      <FlatList
        data={PORTALS}
        keyExtractor={(portal) => portal.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Link href={`/portal/${item.id}`} style={styles.card} accessibilityRole="link">
            <Text style={styles.cardTitle}>{item.nombre}</Text>
          </Link>
        )}
      />

      <Link href="/capturas" style={styles.link} accessibilityRole="link">
        Ver capturas
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 8 },
  title: { fontSize: 32, fontWeight: '700' },
  subtitle: { fontSize: 14, opacity: 0.6, marginBottom: 12 },
  list: { gap: 12 },
  card: { padding: 20, borderRadius: 12, backgroundColor: '#E5E7EB' },
  cardTitle: { fontSize: 18, fontWeight: '600' },
  link: { paddingVertical: 16, fontWeight: '600' },
});

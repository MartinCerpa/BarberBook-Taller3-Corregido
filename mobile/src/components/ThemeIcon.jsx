import { StyleSheet, View } from 'react-native';

const sunAngles = [0, 45, 90, 135, 180, 225, 270, 315];

export function ThemeIcon({ nextIsLight, color, background }) {
  return (
    <View aria-hidden style={styles.frame}>
      {nextIsLight ? (
        <>
          {sunAngles.map((angle) => (
            <View key={angle} style={[styles.rayTrack, { transform: [{ rotate: `${angle}deg` }] }]}>
              <View style={[styles.ray, { backgroundColor: color }]} />
            </View>
          ))}
          <View style={[styles.sun, { borderColor: color }]} />
        </>
      ) : (
        <>
          <View style={[styles.moon, { backgroundColor: color }]} />
          <View style={[styles.cutout, { backgroundColor: background }]} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  rayTrack: { position: 'absolute', top: 1, bottom: 1, left: 11, width: 2, alignItems: 'center' },
  ray: { width: 1.5, height: 3.5, borderRadius: 1 },
  sun: { width: 11, height: 11, borderWidth: 1.5, borderRadius: 6 },
  moon: { width: 17, height: 17, borderRadius: 9 },
  cutout: { position: 'absolute', top: 1, right: 2, width: 15, height: 15, borderRadius: 8 },
});

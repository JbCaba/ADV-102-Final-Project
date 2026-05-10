import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './src/config/firebase';
import AuthNavigator from './src/navigation/AuthNavigator';
import MainTabs from './src/navigation/MainTabs';
import { seedItemsIfEmpty } from './src/utils/seedItems';

export default function App() {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    // Seed the items collection on startup (no-op if already seeded)
    seedItemsIfEmpty();

    const unsubscribe = onAuthStateChanged(auth, currentUser => {
      setUser(currentUser);
      if (initializing) {
        setInitializing(false);
      }
    });

    return unsubscribe;
  }, [initializing]);

  if (initializing) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#00c9a7" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>{user ? <MainTabs /> : <AuthNavigator />}</NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

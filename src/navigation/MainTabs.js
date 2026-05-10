import { Text, View, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MarketplaceHomeScreen from '../screens/MarketplaceHomeScreen';
import ListingsScreen from '../screens/ListingsScreen';
import SellScreen from '../screens/SellScreen';
import ProfileScreen from '../screens/ProfileScreen';
import TopUpScreen from '../screens/TopUpScreen';
import AdminScreen from '../screens/AdminScreen';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { useUserBalance } from '../hooks/useUserBalance';
import { market } from '../constants/marketplaceTheme';

const Tab = createBottomTabNavigator();

function BalBadge() {
  const b = useUserBalance();
  if (b <= 0) return null;
  return (
    <View style={{ position: 'absolute', top: -4, right: -10, backgroundColor: market.gold, borderRadius: 7, paddingHorizontal: 4, paddingVertical: 1, minWidth: 16, alignItems: 'center' }}>
      <Text style={{ color: market.dark, fontSize: 7, fontWeight: '900' }}>${b >= 1000 ? `${Math.floor(b / 1000)}k` : b}</Text>
    </View>
  );
}

function TabIcon({ emoji, badge }) {
  return <View style={{ alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 18 }}>{emoji}</Text>{badge}</View>;
}

export default function MainTabs() {
  const isAdmin = useIsAdmin();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: market.dark,
          borderTopWidth: 1, borderTopColor: market.border,
          height: 58, paddingTop: 5, paddingBottom: 5,
          ...Platform.select({ web: { boxShadow: '0 -2px 12px rgba(0,0,0,0.3)' } }),
        },
        tabBarActiveTintColor: market.cyan,
        tabBarInactiveTintColor: '#374151',
        tabBarLabelStyle: { fontSize: 9, fontWeight: '800', marginTop: 1, letterSpacing: 0.3 },
        sceneContainerStyle: { backgroundColor: market.pageBg },
      }}
    >
      <Tab.Screen name="Home" component={MarketplaceHomeScreen} options={{ tabBarLabel: 'Market', tabBarIcon: () => <TabIcon emoji="🏪" /> }} />
      <Tab.Screen name="Listings" component={ListingsScreen} options={{ tabBarLabel: 'My Items', tabBarIcon: () => <TabIcon emoji="📋" /> }} />
      <Tab.Screen name="Sell" component={SellScreen} options={{ tabBarLabel: 'Sell', tabBarIcon: () => <TabIcon emoji="⚓" /> }} />
      <Tab.Screen name="TopUp" component={TopUpScreen} options={{ tabBarLabel: 'Coins', tabBarIcon: () => <TabIcon emoji="🪙" badge={<BalBadge />} /> }} />
      {isAdmin && <Tab.Screen name="Admin" component={AdminScreen} options={{ tabBarLabel: 'Admin', tabBarIcon: () => <TabIcon emoji="🛡️" />, tabBarActiveTintColor: market.gold }} />}
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: 'Profile', tabBarIcon: () => <TabIcon emoji="👤" /> }} />
    </Tab.Navigator>
  );
}

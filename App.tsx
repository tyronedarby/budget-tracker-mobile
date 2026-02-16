import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { DataProvider } from './src/context/DataContext';
import { ThemeProvider } from './src/context/ThemeContext';

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <DataProvider>
          <AppNavigator />
          <StatusBar style="auto" />
        </DataProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
} 
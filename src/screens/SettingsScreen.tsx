import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { useTheme } from '../context/ThemeContext';
import { lightColors, darkColors } from '../theme/colors';
import { databaseService } from '../services/database';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';

export default function SettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isDarkMode, setDarkMode } = useTheme();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  
  const colors = isDarkMode ? darkColors : lightColors;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 15,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      padding: 5,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    headerSpacer: {
      width: 34,
    },
    scrollView: {
      flex: 1,
    },
    section: {
      marginTop: 20,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textTertiary,
      marginBottom: 8,
      marginLeft: 20,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    settingItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    settingLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    settingIcon: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: colors.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    settingText: {
      flex: 1,
    },
    settingTitle: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
    },
    settingSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 2,
    },
    settingRight: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    copyrightContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 30,
      paddingHorizontal: 20,
      marginTop: 20,
    },
    copyrightText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 4,
    },
    copyrightSubtext: {
      fontSize: 12,
      color: colors.textTertiary,
      textAlign: 'center',
    },
  });

  const handleExportData = async () => {
    try {
      Alert.alert(
        'Export Data',
        'This will export all your transaction data as a CSV file.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Export', 
            onPress: async () => {
              try {
                // Get all transactions from the database
                const allTransactions = [];
                const currentYear = new Date().getFullYear();
                
                // Get transactions for the last 2 years
                for (let year = currentYear - 1; year <= currentYear; year++) {
                  for (let month = 1; month <= 12; month++) {
                    const monthTransactions = await databaseService.getTransactions(month, year);
                    allTransactions.push(...monthTransactions);
                  }
                }
                
                if (allTransactions.length === 0) {
                  Alert.alert('No Data', 'No transactions found to export.');
                  return;
                }
                
                // Create CSV content
                const csvHeaders = 'Date,Type,Category,Description,Amount\n';
                const csvRows = allTransactions.map(transaction => {
                  const date = new Date(transaction.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                  });
                  const amount = transaction.type === 'expense' ? `-${transaction.amount}` : transaction.amount;
                  const description = transaction.description || '';
                  
                  // Escape commas and quotes in CSV
                  const escapedDescription = description.replace(/"/g, '""');
                  const escapedCategory = transaction.category.replace(/"/g, '""');
                  
                  return `"${date}","${transaction.type}","${escapedCategory}","${escapedDescription}","${amount}"`;
                }).join('\n');
                
                const csvContent = csvHeaders + csvRows;
                
                // Create file name with timestamp
                const timestamp = new Date().toISOString().split('T')[0];
                const fileName = `budget_data_${timestamp}.csv`;
                
                // Save file to app's documents directory
                const fileUri = `${FileSystem.documentDirectory}${fileName}`;
                await FileSystem.writeAsStringAsync(fileUri, csvContent);
                
                // Share the file
                await Sharing.shareAsync(fileUri, {
                  mimeType: 'text/csv',
                  dialogTitle: 'Export Budget Data',
                  UTI: 'public.comma-separated-values-text'
                });
                
                Alert.alert('Success', 'Data exported successfully!');
              } catch (error) {
                console.error('Export error:', error);
                Alert.alert('Error', 'Failed to export data. Please try again.');
              }
            }
          },
        ]
      );
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Error', 'Failed to export data. Please try again.');
    }
  };

  const handlePrivacyPolicy = async () => {
    try {
      const url = 'https://www.privacypolicygenerator.info/live.php?token=YourPrivacyPolicyToken';
      const supported = await Linking.canOpenURL(url);
      
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Unable to open privacy policy. Please check your internet connection.');
      }
    } catch (error) {
      console.error('Error opening privacy policy:', error);
      Alert.alert('Error', 'Unable to open privacy policy. Please try again.');
    }
  };

  const handleTermsOfService = async () => {
    try {
      const url = 'https://www.termsofservicegenerator.info/live.php?token=YourTermsOfServiceToken';
      const supported = await Linking.canOpenURL(url);
      
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Unable to open terms of service. Please check your internet connection.');
      }
    } catch (error) {
      console.error('Error opening terms of service:', error);
      Alert.alert('Error', 'Unable to open terms of service. Please try again.');
    }
  };

  const handleClearData = () => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all your transactions, goals, and settings. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear Data', 
          style: 'destructive', 
          onPress: async () => {
            try {
              // Show confirmation dialog
              Alert.alert(
                'Final Confirmation',
                'Are you absolutely sure? This will delete ALL your data permanently.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Yes, Delete Everything',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        // Clear all data from the database
                        await databaseService.clearAllData();
                        
                        // Clear theme preference
                        await AsyncStorage.removeItem('theme_preference');
                        
                        // Clear notification preference
                        await AsyncStorage.removeItem('notifications_enabled');
                        
                        // Reset theme to default (light mode)
                        setDarkMode(false);
                        
                        // Reset notifications setting
                        setNotificationsEnabled(true);
                        
                        Alert.alert(
                          'Data Cleared',
                          'All your data has been successfully cleared. The app will restart.',
                          [
                            {
                              text: 'OK',
                              onPress: () => {
                                // Navigate back to main screen
                                navigation.navigate('Home');
                              }
                            }
                          ]
                        );
                      } catch (error) {
                        console.error('Clear data error:', error);
                        Alert.alert('Error', 'Failed to clear data. Please try again.');
                      }
                    }
                  }
                ]
              );
            } catch (error) {
              console.error('Clear data error:', error);
              Alert.alert('Error', 'Failed to clear data. Please try again.');
            }
          }
        },
      ]
    );
  };

  const renderSettingItem = (
    icon: keyof typeof Ionicons.glyphMap,
    title: string,
    subtitle?: string,
    onPress?: () => void,
    showSwitch?: boolean,
    switchValue?: boolean,
    onSwitchChange?: (value: boolean) => void,
    showArrow: boolean = true
  ) => (
    <TouchableOpacity 
      style={styles.settingItem} 
      onPress={onPress}
      disabled={!onPress && !showSwitch}
    >
      <View style={styles.settingLeft}>
        <View style={styles.settingIcon}>
          <Ionicons name={icon} size={20} color="#007AFF" />
        </View>
        <View style={styles.settingText}>
          <Text style={styles.settingTitle}>{title}</Text>
          {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      <View style={styles.settingRight}>
        {showSwitch && (
          <Switch
            value={switchValue}
            onValueChange={onSwitchChange}
            trackColor={{ false: '#E5E5E5', true: '#007AFF' }}
            thumbColor="#fff"
          />
        )}
        {showArrow && !showSwitch && (
          <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          {renderSettingItem(
            'notifications-outline',
            'Push Notifications',
            'Get alerts for budget goals and reminders',
            undefined,
            true,
            notificationsEnabled,
            setNotificationsEnabled,
            false
          )}
          {renderSettingItem(
            'moon-outline',
            'Dark Mode',
            'Switch to dark theme',
            undefined,
            true,
            isDarkMode,
            setDarkMode,
            false
          )}
        </View>

        {/* Data Management Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Management</Text>
          {renderSettingItem(
            'download-outline',
            'Export Data',
            'Download your data as CSV file',
            handleExportData
          )}
          {renderSettingItem(
            'trash-outline',
            'Clear All Data',
            'Permanently delete all data',
            handleClearData
          )}
        </View>

        {/* Categories & Goals Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Categories & Goals</Text>
          {renderSettingItem(
            'sparkles-outline',
            'Customize Categories',
            'Add, edit, or remove categories',
            () => navigation.navigate('CustomizeCategories')
          )}
          {renderSettingItem(
            'flag-outline',
            'Budget Goals',
            'Manage your budget goals',
            () => {
              navigation.navigate('Home', { screen: 'Goals' });
            }
          )}
        </View>

        {/* Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          {renderSettingItem(
            'help-circle-outline',
            'Help & FAQ',
            'Get help and answers'
          )}
          {renderSettingItem(
            'mail-outline',
            'Contact Support',
            'Send us a message'
          )}
          {renderSettingItem(
            'star-outline',
            'Rate App',
            'Rate us on the App Store'
          )}
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          {renderSettingItem(
            'information-circle-outline',
            'App Version',
            '1.0.0',
            undefined,
            false,
            undefined,
            undefined,
            false
          )}
          {renderSettingItem(
            'document-text-outline',
            'Privacy Policy',
            'Read our privacy policy',
            handlePrivacyPolicy
          )}
          {renderSettingItem(
            'document-outline',
            'Terms of Service',
            'Read our terms of service',
            handleTermsOfService
          )}
        </View>

        {/* Copyright Notice */}
        <View style={styles.copyrightContainer}>
          <Text style={styles.copyrightText}>
            © 2025 Budget Tracker App. All rights reserved.
          </Text>
          <Text style={styles.copyrightSubtext}>
            Made with ❤️ for better financial management
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
} 
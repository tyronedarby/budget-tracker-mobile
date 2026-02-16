import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { databaseService, Category } from '../services/database';
import { useDataContext } from '../context/DataContext';
import { useTheme } from '../context/ThemeContext';
import { lightColors, darkColors } from '../theme/colors';

export default function AddTransactionScreen() {
  const { triggerRefresh, refreshTrigger } = useDataContext();
  const { isDarkMode } = useTheme();
  const colors = isDarkMode ? darkColors : lightColors;
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  // Load categories from database
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const cats = await databaseService.getCategories();
        setCategories(cats);
        
        // Clear selected category if it no longer exists
        if (category) {
          const currentTypeCategories = cats
            .filter(cat => cat.type === type)
            .map(cat => cat.name);
          if (!currentTypeCategories.includes(category)) {
            setCategory('');
          }
        }
      } catch (error) {
        console.error('Error loading categories:', error);
      }
    };
    loadCategories();
  }, [refreshTrigger, type]); // Reload when refreshTrigger changes or type changes

  // Filter categories by type
  const availableCategories = categories
    .filter(cat => cat.type === type)
    .map(cat => cat.name);

  // Create dynamic styles
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      backgroundColor: colors.surface,
      paddingHorizontal: 20,
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
    },
    keyboardAvoidingView: {
      flex: 1,
    },
    scrollView: {
      flex: 1,
      padding: 20,
    },
    typeSelector: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 4,
      marginBottom: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    typeButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      gap: 8,
    },
    typeButtonActive: {
      backgroundColor: colors.primary,
    },
    typeButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    typeButtonTextActive: {
      color: colors.textInverse,
    },
    inputContainer: {
      marginBottom: 20,
    },
    inputLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    amountInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    currencySymbol: {
      fontSize: 24,
      fontWeight: '600',
      color: colors.text,
      marginRight: 8,
    },
    amountInput: {
      flex: 1,
      fontSize: 24,
      fontWeight: '600',
      color: colors.text,
    },
    textInput: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 16,
      fontSize: 16,
      color: colors.text,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    categoryScrollView: {
      marginBottom: 10,
    },
    categoryButton: {
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 20,
      marginRight: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    categoryButtonActive: {
      backgroundColor: colors.primary,
    },
    categoryButtonText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
    },
    categoryButtonTextActive: {
      color: colors.textInverse,
    },
    submitButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 12,
      marginTop: 20,
      gap: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    submitButtonDisabled: {
      backgroundColor: colors.textTertiary,
    },
    submitButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textInverse,
    },
  });

  const handleSubmit = async () => {
    if (!category || !amount || !date) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Amount must be greater than 0');
      return;
    }

    setIsSubmitting(true);

    try {
      await databaseService.addTransaction({
        type,
        category,
        amount: parseFloat(amount),
        description: description.trim() || undefined,
        date,
      });

      // Reset form
      setCategory('');
      setAmount('');
      setDescription('');
      setDate(new Date().toISOString().split('T')[0]);

      triggerRefresh();
      Alert.alert('Success', 'Transaction added successfully!');
    } catch (error) {
      console.error('Error adding transaction:', error);
      Alert.alert('Error', 'Failed to add transaction. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Add Transaction</Text>
      </View>

      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Type Selector */}
          <View style={styles.typeSelector}>
            <TouchableOpacity
              style={[styles.typeButton, type === 'expense' && styles.typeButtonActive]}
              onPress={() => {
                setType('expense');
                setCategory(''); // Reset category when switching type
              }}
            >
              <Ionicons 
                name="arrow-down-circle" 
                size={20} 
                color={type === 'expense' ? colors.textInverse : colors.error} 
              />
              <Text style={[styles.typeButtonText, type === 'expense' && styles.typeButtonTextActive]}>
                Expense
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, type === 'income' && styles.typeButtonActive]}
              onPress={() => {
                setType('income');
                setCategory(''); // Reset category when switching type
              }}
            >
              <Ionicons 
                name="arrow-up-circle" 
                size={20} 
                color={type === 'income' ? colors.textInverse : colors.success} 
              />
              <Text style={[styles.typeButtonText, type === 'income' && styles.typeButtonTextActive]}>
                Income
              </Text>
            </TouchableOpacity>

          </View>

          {/* Amount Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Amount</Text>
            <View style={styles.amountInputContainer}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                keyboardType="numeric"
                placeholderTextColor={colors.textTertiary}
              />
            </View>
          </View>

          {/* Category Selector */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Category</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.categoryScrollView}
            >
              {availableCategories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryButton, category === cat && styles.categoryButtonActive]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[styles.categoryButtonText, category === cat && styles.categoryButtonTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Description Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Description (Optional)</Text>
            <TextInput
              style={styles.textInput}
              value={description}
              onChangeText={setDescription}
              placeholder="Enter description..."
              placeholderTextColor={colors.textTertiary}
              multiline
            />
          </View>

          {/* Date Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Date</Text>
            <TextInput
              style={styles.textInput}
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textTertiary}
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity 
            style={[styles.submitButton, (isSubmitting || !category || !amount || !date) && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting || !category || !amount || !date}
          >
            {isSubmitting ? (
              <>
                <Ionicons name="hourglass" size={20} color={colors.textInverse} />
                <Text style={styles.submitButtonText}>Adding...</Text>
              </>
            ) : (
              <>
                <Ionicons name="add" size={20} color={colors.textInverse} />
                <Text style={styles.submitButtonText}>Add Transaction</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
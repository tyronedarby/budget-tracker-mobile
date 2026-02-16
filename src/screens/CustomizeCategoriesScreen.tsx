import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { databaseService, Category } from '../services/database';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { useTheme } from '../context/ThemeContext';
import { lightColors, darkColors } from '../theme/colors';
import { useDataContext } from '../context/DataContext';

export default function CustomizeCategoriesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isDarkMode } = useTheme();
  const colors = isDarkMode ? darkColors : lightColors;
  const { triggerRefresh, refreshTrigger } = useDataContext();
  const [categories, setCategories] = useState<Category[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'expense' as 'income' | 'expense',
  });
  const [selectedType, setSelectedType] = useState<'income' | 'expense'>('expense');

  useEffect(() => {
    loadCategories();
  }, [refreshTrigger]); // Listen to refresh triggers from other screens

  const loadCategories = async () => {
    try {
      const categories = await databaseService.getCategories();
      setCategories(categories);
    } catch (error) {
      console.error('Error loading categories:', error);
      Alert.alert('Error', 'Failed to load categories');
    }
  };

  const handleAddCategory = () => {
    setEditingCategory(null);
    setFormData({ name: '', type: selectedType });
    setModalVisible(true);
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setFormData({ name: category.name, type: category.type });
    setModalVisible(true);
  };

  const handleDeleteCategory = (category: Category) => {
    if (!category.isCustom) {
      Alert.alert('Cannot Delete', 'Default categories cannot be deleted');
      return;
    }

    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${category.name}"? This will also update it to "Other" in any existing transactions and goals.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await databaseService.deleteCategory(category.id);
              await loadCategories();
              triggerRefresh(); // Trigger refresh across the app
              Alert.alert('Success', 'Category deleted successfully. All transactions and goals using this category have been updated to "Other".');
            } catch (error) {
              console.error('Error deleting category:', error);
              Alert.alert('Error', error instanceof Error ? error.message : 'Failed to delete category');
            }
          },
        },
      ]
    );
  };

  const handleSaveCategory = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Please enter a category name');
      return;
    }

    if (categories.some(cat => cat.name.toLowerCase() === formData.name.trim().toLowerCase() && cat.id !== editingCategory?.id)) {
      Alert.alert('Error', 'A category with this name already exists');
      return;
    }

    try {
      if (editingCategory) {
        // Update existing category
        await databaseService.updateCategory(editingCategory.id, {
          name: formData.name.trim(),
          type: formData.type
        });
        triggerRefresh(); // Trigger refresh across the app
        Alert.alert('Success', 'Category updated successfully. All transactions and goals using this category have been updated.');
      } else {
        // Add new category
        await databaseService.addCategory({
          name: formData.name.trim(),
          type: formData.type,
          isCustom: true
        });
        triggerRefresh(); // Trigger refresh across the app
        Alert.alert('Success', 'Category added successfully');
      }

      setModalVisible(false);
      await loadCategories();
    } catch (error) {
      console.error('Error saving category:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save category');
    }
  };

  const filteredCategories = categories.filter(cat => cat.type === selectedType);

  // Create dynamic styles
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
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
      flex: 1,
      textAlign: 'center',
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    headerSpacer: {
      width: 34,
    },
    typeSelector: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      margin: 20,
      borderRadius: 12,
      padding: 4,
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
    scrollView: {
      flex: 1,
      paddingHorizontal: 20,
    },
    categoriesContainer: {
      marginBottom: 20,
    },
    categoryItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      padding: 16,
      borderRadius: 12,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    categoryLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    categoryIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    categoryName: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
      flex: 1,
    },
    categoryActions: {
      flexDirection: 'row',
      gap: 8,
    },
    actionButton: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: colors.borderLight,
    },
    deleteButton: {
      backgroundColor: colors.errorLight,
    },
    addButton: {
      backgroundColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      borderRadius: 12,
      margin: 20,
      gap: 8,
    },
    addButtonText: {
      color: colors.textInverse,
      fontSize: 16,
      fontWeight: '600',
    },
    modalContainer: {
      flex: 1,
      backgroundColor: colors.modalBackground,
      justifyContent: 'center',
    },
    modalContent: {
      backgroundColor: colors.modalSurface,
      margin: 20,
      borderRadius: 12,
      padding: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 20,
    },
    inputContainer: {
      marginBottom: 20,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textSecondary,
      marginBottom: 8,
    },
    textInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.background,
    },
    typeOptions: {
      flexDirection: 'row',
      backgroundColor: colors.borderLight,
      borderRadius: 8,
      padding: 4,
      marginBottom: 20,
    },
    typeOption: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 8,
      borderRadius: 6,
    },
    typeOptionActive: {
      backgroundColor: colors.primary,
    },
    typeOptionText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    typeOptionTextActive: {
      color: colors.textInverse,
    },
    modalButtons: {
      flexDirection: 'row',
      gap: 12,
    },
    modalButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    cancelButton: {
      backgroundColor: colors.borderLight,
    },
    saveButton: {
      backgroundColor: colors.primary,
    },
    cancelButtonText: {
      color: colors.textSecondary,
      fontSize: 16,
      fontWeight: '500',
    },
    saveButtonText: {
      color: colors.textInverse,
      fontSize: 16,
      fontWeight: '600',
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Customize Categories</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Type Selector */}
      <View style={styles.typeSelector}>
        <TouchableOpacity
          style={[styles.typeButton, selectedType === 'expense' && styles.typeButtonActive]}
          onPress={() => setSelectedType('expense')}
        >
          <Ionicons 
            name="arrow-down-circle" 
            size={20} 
            color={selectedType === 'expense' ? colors.textInverse : colors.error} 
          />
          <Text style={[styles.typeButtonText, selectedType === 'expense' && styles.typeButtonTextActive]}>
            Expenses
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.typeButton, selectedType === 'income' && styles.typeButtonActive]}
          onPress={() => setSelectedType('income')}
        >
          <Ionicons 
            name="arrow-up-circle" 
            size={20} 
            color={selectedType === 'income' ? colors.textInverse : colors.success} 
          />
          <Text style={[styles.typeButtonText, selectedType === 'income' && styles.typeButtonTextActive]}>
            Income
          </Text>
        </TouchableOpacity>
      </View>

      {/* Categories List */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.categoriesContainer}>
          {filteredCategories.map((category) => (
            <View key={category.id} style={styles.categoryItem}>
              <View style={styles.categoryLeft}>
                <View style={styles.categoryIcon}>
                  <Ionicons 
                    name={selectedType === 'expense' ? 'remove-circle' : 'add-circle'} 
                    size={24} 
                    color={colors.primary} 
                  />
                </View>
                <Text style={styles.categoryName}>{category.name}</Text>
              </View>
              <View style={styles.categoryActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleEditCategory(category)}
                >
                  <Ionicons name="pencil" size={20} color={colors.primary} />
                </TouchableOpacity>
                {category.isCustom && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => handleDeleteCategory(category)}
                  >
                    <Ionicons name="trash" size={20} color={colors.error} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Add Category Button */}
        <TouchableOpacity style={styles.addButton} onPress={handleAddCategory}>
          <Ionicons name="add" size={24} color={colors.textInverse} />
          <Text style={styles.addButtonText}>Add {selectedType === 'expense' ? 'Expense' : 'Income'} Category</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Add/Edit Category Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingCategory ? 'Edit Category' : 'Add New Category'}
            </Text>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Category Name</Text>
              <TextInput
                style={styles.textInput}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder="Enter category name"
                placeholderTextColor={colors.textTertiary}
                autoFocus
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Type</Text>
              <View style={styles.typeOptions}>
                <TouchableOpacity
                  style={[styles.typeOption, formData.type === 'expense' && styles.typeOptionActive]}
                  onPress={() => setFormData({ ...formData, type: 'expense' })}
                >
                  <Text style={[styles.typeOptionText, formData.type === 'expense' && styles.typeOptionTextActive]}>
                    Expense
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeOption, formData.type === 'income' && styles.typeOptionActive]}
                  onPress={() => setFormData({ ...formData, type: 'income' })}
                >
                  <Text style={[styles.typeOptionText, formData.type === 'income' && styles.typeOptionTextActive]}>
                    Income
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSaveCategory}
              >
                <Text style={styles.saveButtonText}>
                  {editingCategory ? 'Update' : 'Add'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { databaseService, BudgetGoal, Category } from '../services/database';
import { TransactionStats } from '../types';
import { useDataContext } from '../context/DataContext';

export default function BudgetGoalsScreen() {
  const { refreshTrigger, triggerRefresh } = useDataContext();
  const [goals, setGoals] = useState<BudgetGoal[]>([]);
  const [stats, setStats] = useState<TransactionStats>({
    totalIncome: 0,
    totalExpense: 0,
    netBalance: 0,
    expensesByCategory: {},
  });
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingGoal, setEditingGoal] = useState<BudgetGoal | null>(null);
  const [formData, setFormData] = useState({
    category: '',
    amount: '',
    period: 'monthly' as 'monthly' | 'annual',
    isActive: true,
  });
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    loadData();
  }, [selectedMonth, selectedYear, refreshTrigger]);

  const loadData = async () => {
    try {
      const [goalsData, statsData, categoriesData] = await Promise.all([
        databaseService.getBudgetGoals(),
        databaseService.getTransactionStats(selectedMonth, selectedYear),
        databaseService.getCategories(),
      ]);
      console.log('Loaded categories:', categoriesData); // Debug log
      setGoals(goalsData);
      setStats(statsData);
      setCategories(categoriesData);
      
      // Clear selected category in form if it no longer exists
      if (formData.category) {
        const expenseCategories = categoriesData
          .filter(cat => cat.type === 'expense')
          .map(cat => cat.name);
        if (!expenseCategories.includes(formData.category)) {
          setFormData(prev => ({ ...prev, category: '' }));
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load budget goals');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getGoalProgress = (goal: BudgetGoal) => {
    const currentSpending = stats.expensesByCategory[goal.category] || 0;
    const percentage = Math.min((currentSpending / goal.amount) * 100, 100);
    return { currentSpending, percentage };
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return '#FF3B30';
    if (percentage >= 80) return '#FF9500';
    if (percentage >= 60) return '#FFCC00';
    return '#34C759';
  };

  const handleAddGoal = () => {
    setEditingGoal(null);
    setFormData({
      category: '',
      amount: '',
      period: 'monthly',
      isActive: true,
    });
    setModalVisible(true);
  };

  const handleEditGoal = (goal: BudgetGoal) => {
    setEditingGoal(goal);
    setFormData({
      category: goal.category,
      amount: goal.amount.toString(),
      period: goal.period,
      isActive: goal.isActive,
    });
    setModalVisible(true);
  };

  const handleSaveGoal = async () => {
    if (!formData.category || !formData.amount) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    try {
      if (editingGoal) {
        await databaseService.updateBudgetGoal(editingGoal.id, {
          category: formData.category,
          amount,
          period: formData.period,
          isActive: formData.isActive,
        });
      } else {
        await databaseService.addBudgetGoal({
          category: formData.category,
          amount,
          period: formData.period,
          isActive: formData.isActive,
        });
      }
      
      setModalVisible(false);
      triggerRefresh(); // This will refresh all screens including dashboard
    } catch (error) {
      console.error('Error saving goal:', error);
      Alert.alert('Error', 'Failed to save budget goal');
    }
  };

  const handleDeleteGoal = (goal: BudgetGoal) => {
    Alert.alert(
      'Delete Goal',
      `Are you sure you want to delete the budget goal for ${goal.category}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await databaseService.deleteBudgetGoal(goal.id);
              triggerRefresh(); // This will refresh all screens including dashboard
            } catch (error) {
              console.error('Error deleting goal:', error);
              Alert.alert('Error', 'Failed to delete budget goal');
            }
          },
        },
      ]
    );
  };

  const handleToggleGoal = async (goal: BudgetGoal) => {
    try {
      await databaseService.updateBudgetGoal(goal.id, { isActive: !goal.isActive });
      triggerRefresh(); // This will refresh all screens including dashboard
    } catch (error) {
      console.error('Error toggling goal:', error);
      Alert.alert('Error', 'Failed to update budget goal');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>Budget Goals</Text>
          <View style={styles.dateSelector}>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => {
                if (selectedMonth > 1) {
                  setSelectedMonth(selectedMonth - 1);
                } else {
                  setSelectedMonth(12);
                  setSelectedYear(selectedYear - 1);
                }
              }}
            >
              <Ionicons name="chevron-back" size={20} color="#007AFF" />
            </TouchableOpacity>
            <Text style={styles.dateText}>
              {new Date(selectedYear, selectedMonth - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => {
                if (selectedMonth < 12) {
                  setSelectedMonth(selectedMonth + 1);
                } else {
                  setSelectedMonth(1);
                  setSelectedYear(selectedYear + 1);
                }
              }}
            >
              <Ionicons name="chevron-forward" size={20} color="#007AFF" />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.addButton} onPress={handleAddGoal}>
          <Ionicons name="add" size={24} color="white" />
          <Text style={styles.addButtonText}>Add Budget Goal</Text>
        </TouchableOpacity>

        {/* Category Spending Summary */}
        {Object.keys(stats.expensesByCategory).length > 0 && (
          <View style={styles.categorySummaryContainer}>
            <Text style={styles.categorySummaryTitle}>Current Month Spending by Category</Text>
            {Object.entries(stats.expensesByCategory)
              .sort(([,a], [,b]) => b - a) // Sort by amount descending
              .map(([category, amount]) => (
                <View key={category} style={styles.categorySummaryItem}>
                  <Text style={styles.categorySummaryName}>{category}</Text>
                  <Text style={styles.categorySummaryAmount}>{formatCurrency(amount)}</Text>
                </View>
              ))}
          </View>
        )}

        {goals.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="flag" size={64} color="#ccc" />
            <Text style={styles.emptyStateText}>No budget goals set</Text>
            <Text style={styles.emptyStateSubtext}>Add a goal to start tracking your spending</Text>
          </View>
        ) : (
          <View style={styles.goalsContainer}>
            {goals.map((goal) => {
              const { currentSpending, percentage } = getGoalProgress(goal);
              const progressColor = getProgressColor(percentage);
              
              return (
                <View key={goal.id} style={styles.goalCard}>
                  <View style={styles.goalHeader}>
                    <View style={styles.goalInfo}>
                      <Text style={styles.goalCategory}>{goal.category}</Text>
                      <Text style={styles.goalAmount}>
                        {formatCurrency(goal.amount)} / {goal.period}
                      </Text>
                    </View>
                    <View style={styles.goalActions}>
                      <Switch
                        value={goal.isActive}
                        onValueChange={() => handleToggleGoal(goal)}
                        trackColor={{ false: '#767577', true: '#34C759' }}
                        thumbColor={goal.isActive ? '#fff' : '#f4f3f4'}
                      />
                      <TouchableOpacity
                        style={styles.editButton}
                        onPress={() => handleEditGoal(goal)}
                      >
                        <Ionicons name="pencil" size={16} color="#007AFF" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleDeleteGoal(goal)}
                      >
                        <Ionicons name="trash" size={16} color="#FF3B30" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.progressContainer}>
                    <View style={styles.progressInfo}>
                      <Text style={styles.progressText}>
                        {formatCurrency(currentSpending)} / {formatCurrency(goal.amount)}
                      </Text>
                      <Text style={[styles.progressPercentage, { color: progressColor }]}>
                        {percentage.toFixed(1)}%
                      </Text>
                    </View>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${Math.min(percentage, 100)}%`,
                            backgroundColor: progressColor,
                          },
                        ]}
                      />
                    </View>
                  </View>

                  {percentage >= 100 && (
                    <View style={styles.alertContainer}>
                      <Ionicons name="warning" size={16} color="#FF3B30" />
                      <Text style={styles.alertText}>Budget exceeded!</Text>
                    </View>
                  )}
                  {percentage >= 80 && percentage < 100 && (
                    <View style={styles.warningContainer}>
                      <Ionicons name="alert-circle" size={16} color="#FF9500" />
                      <Text style={styles.warningText}>Approaching budget limit</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Add/Edit Goal Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingGoal ? 'Edit Budget Goal' : 'Add Budget Goal'}
              </Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScrollView} showsVerticalScrollIndicator={false}>
              <View style={styles.formContainer}>
                <Text style={styles.label}>Category</Text>
                <View style={styles.categorySelector}>
                  {categories.filter(cat => cat.type === 'expense').map((category) => (
                    <TouchableOpacity
                      key={category.id}
                      style={[
                        styles.categoryButton,
                        formData.category === category.name && styles.categoryButtonActive,
                      ]}
                      onPress={() => setFormData({ ...formData, category: category.name })}
                    >
                      <Text
                        style={[
                          styles.categoryButtonText,
                          formData.category === category.name && styles.categoryButtonTextActive,
                        ]}
                      >
                        {category.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Amount</Text>
                <TextInput
                  style={styles.input}
                  value={formData.amount}
                  onChangeText={(text) => setFormData({ ...formData, amount: text })}
                  placeholder="Enter amount"
                  keyboardType="numeric"
                  placeholderTextColor="#999"
                />

                <Text style={styles.label}>Period</Text>
                <View style={styles.periodSelector}>
                  <TouchableOpacity
                    style={[
                      styles.periodButton,
                      formData.period === 'monthly' && styles.periodButtonActive,
                    ]}
                    onPress={() => setFormData({ ...formData, period: 'monthly' })}
                  >
                    <Text
                      style={[
                        styles.periodButtonText,
                        formData.period === 'monthly' && styles.periodButtonTextActive,
                      ]}
                    >
                      Monthly
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.periodButton,
                      formData.period === 'annual' && styles.periodButtonActive,
                    ]}
                    onPress={() => setFormData({ ...formData, period: 'annual' })}
                  >
                    <Text
                      style={[
                        styles.periodButtonText,
                        formData.period === 'annual' && styles.periodButtonTextActive,
                      ]}
                    >
                      Annual
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.switchContainer}>
                  <Text style={styles.label}>Active</Text>
                  <Switch
                    value={formData.isActive}
                    onValueChange={(value) => setFormData({ ...formData, isActive: value })}
                    trackColor={{ false: '#767577', true: '#34C759' }}
                    thumbColor={formData.isActive ? '#fff' : '#f4f3f4'}
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveGoal}>
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 20,
    backgroundColor: 'white',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateButton: {
    padding: 10,
  },
  dateText: {
    fontSize: 18,
    fontWeight: '600',
    marginHorizontal: 20,
    color: '#333',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    margin: 20,
    padding: 15,
    borderRadius: 10,
    gap: 10,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 12,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 15,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 5,
  },
  goalsContainer: {
    padding: 20,
  },
  goalCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  goalInfo: {
    flex: 1,
  },
  goalCategory: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  goalAmount: {
    fontSize: 14,
    color: '#666',
  },
  goalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  editButton: {
    padding: 5,
  },
  deleteButton: {
    padding: 5,
  },
  progressContainer: {
    marginBottom: 10,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 14,
    color: '#666',
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  alertContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE5E5',
    padding: 10,
    borderRadius: 8,
    gap: 8,
  },
  alertText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '600',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF4E5',
    padding: 10,
    borderRadius: 8,
    gap: 8,
  },
  warningText: {
    color: '#FF9500',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: '90%',
    maxHeight: '85%',
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  formScrollView: {
    flex: 1,
    minHeight: 300,
  },
  formContainer: {
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    margin: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  categorySelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  categoryButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: 'white',
  },
  categoryButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  categoryButtonText: {
    fontSize: 14,
    color: '#666',
  },
  categoryButtonTextActive: {
    color: 'white',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  periodSelector: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  periodButtonText: {
    fontSize: 16,
    color: '#666',
  },
  periodButtonTextActive: {
    color: 'white',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
  categorySummaryContainer: {
    backgroundColor: 'white',
    margin: 20,
    padding: 20,
    borderRadius: 12,
  },
  categorySummaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  categorySummaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  categorySummaryName: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  categorySummaryAmount: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
}); 
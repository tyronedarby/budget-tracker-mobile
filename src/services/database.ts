import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description?: string;
  date: string;
}

export interface BudgetGoal {
  id: string;
  category: string;
  amount: number;
  period: 'monthly' | 'annual';
  isActive: boolean;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  isCustom: boolean;
  icon?: string;
  createdAt: string;
}

class DatabaseService {
  private readonly STORAGE_KEY = 'budget_tracker_transactions';
  private readonly GOALS_STORAGE_KEY = 'budget_tracker_goals';
  private readonly CATEGORIES_STORAGE_KEY = 'budget_tracker_categories';

  async addTransaction(transaction: Omit<Transaction, 'id'>): Promise<Transaction> {
    try {
      const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      const newTransaction: Transaction = { ...transaction, id };

      const existingTransactions = await this.getTransactions();
      const updatedTransactions = [newTransaction, ...existingTransactions];

      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedTransactions));
      return newTransaction;
    } catch (error) {
      console.error('Error adding transaction:', error);
      throw error;
    }
  }

  async getTransactions(month?: number, year?: number): Promise<Transaction[]> {
    try {
      const transactionsJson = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (!transactionsJson) {
        return [];
      }

      let transactions: Transaction[] = JSON.parse(transactionsJson);

      if (month && year) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        transactions = transactions.filter(transaction => {
          const transactionDate = new Date(transaction.date);
          return transactionDate >= startDate && transactionDate <= endDate;
        });
      }

      return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (error) {
      console.error('Error getting transactions:', error);
      return [];
    }
  }

  async deleteTransaction(id: string): Promise<void> {
    try {
      const transactions = await this.getTransactions();
      const updatedTransactions = transactions.filter(t => t.id !== id);
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedTransactions));
    } catch (error) {
      console.error('Error deleting transaction:', error);
      throw error;
    }
  }

  async getTransactionStats(month?: number, year?: number): Promise<{
    totalIncome: number;
    totalExpense: number;
    netBalance: number;
    expensesByCategory: Record<string, number>;
  }> {
    const transactions = await this.getTransactions(month, year);

    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpense = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const netBalance = totalIncome - totalExpense;

    const expensesByCategory = transactions
      .filter(t => t.type === 'expense')
      .reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
      }, {} as Record<string, number>);

    return {
      totalIncome,
      totalExpense,
      netBalance,
      expensesByCategory
    };
  }

  // Budget Goals Management
  async addBudgetGoal(goal: Omit<BudgetGoal, 'id' | 'createdAt'>): Promise<BudgetGoal> {
    try {
      const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      const newGoal: BudgetGoal = {
        ...goal,
        id,
        createdAt: new Date().toISOString()
      };

      const existingGoals = await this.getBudgetGoals();
      const updatedGoals = [newGoal, ...existingGoals];

      await AsyncStorage.setItem(this.GOALS_STORAGE_KEY, JSON.stringify(updatedGoals));
      return newGoal;
    } catch (error) {
      console.error('Error adding budget goal:', error);
      throw error;
    }
  }

  async getBudgetGoals(): Promise<BudgetGoal[]> {
    try {
      const goalsJson = await AsyncStorage.getItem(this.GOALS_STORAGE_KEY);
      if (!goalsJson) {
        return [];
      }
      return JSON.parse(goalsJson);
    } catch (error) {
      console.error('Error getting budget goals:', error);
      return [];
    }
  }

  async updateBudgetGoal(id: string, updates: Partial<BudgetGoal>): Promise<void> {
    try {
      const goals = await this.getBudgetGoals();
      const updatedGoals = goals.map(goal =>
        goal.id === id ? { ...goal, ...updates } : goal
      );
      await AsyncStorage.setItem(this.GOALS_STORAGE_KEY, JSON.stringify(updatedGoals));
    } catch (error) {
      console.error('Error updating budget goal:', error);
      throw error;
    }
  }

  async deleteBudgetGoal(id: string): Promise<void> {
    try {
      const goals = await this.getBudgetGoals();
      const updatedGoals = goals.filter(goal => goal.id !== id);
      await AsyncStorage.setItem(this.GOALS_STORAGE_KEY, JSON.stringify(updatedGoals));
    } catch (error) {
      console.error('Error deleting budget goal:', error);
      throw error;
    }
  }

  async checkBudgetAlerts(month?: number, year?: number): Promise<{
    exceededGoals: Array<{
      goal: BudgetGoal;
      currentSpending: number;
      percentage: number;
    }>;
    warningGoals: Array<{
      goal: BudgetGoal;
      currentSpending: number;
      percentage: number;
    }>;
  }> {
    try {
      const goals = await this.getBudgetGoals();
      const stats = await this.getTransactionStats(month, year);

      const exceededGoals: Array<{
        goal: BudgetGoal;
        currentSpending: number;
        percentage: number;
      }> = [];

      const warningGoals: Array<{
        goal: BudgetGoal;
        currentSpending: number;
        percentage: number;
      }> = [];

      goals.forEach(goal => {
        if (!goal.isActive) return;

        const currentSpending = stats.expensesByCategory[goal.category] || 0;
        const percentage = (currentSpending / goal.amount) * 100;

        if (percentage >= 100) {
          exceededGoals.push({ goal, currentSpending, percentage });
        } else if (percentage >= 80) {
          warningGoals.push({ goal, currentSpending, percentage });
        }
      });

      return { exceededGoals, warningGoals };
    } catch (error) {
      console.error('Error checking budget alerts:', error);
      return { exceededGoals: [], warningGoals: [] };
    }
  }

  async getUniqueCategories(): Promise<string[]> {
    try {
      const transactions = await this.getTransactions();
      const categories = transactions
        .filter(t => t.type === 'expense')
        .map(t => t.category);
      
      // Default categories that should always be available
      const defaultCategories = [
        'Food & Dining', 'Transportation', 'Shopping', 'Entertainment',
        'Healthcare', 'Utilities', 'Housing', 'Education', 'Travel', 'Other'
      ];
      
      // Combine transaction categories with default categories, remove duplicates and sort
      const allCategories = [...new Set([...categories, ...defaultCategories])].sort();
      
      return allCategories;
    } catch (error) {
      console.error('Error getting unique categories:', error);
      return [
        'Food & Dining', 'Transportation', 'Shopping', 'Entertainment',
        'Healthcare', 'Utilities', 'Housing', 'Education', 'Travel', 'Other'
      ];
    }
  }

  // Category management methods
  async getCategories(): Promise<Category[]> {
    try {
      const categoriesJson = await AsyncStorage.getItem(this.CATEGORIES_STORAGE_KEY);
      if (!categoriesJson) {
        // Initialize with default categories
        const defaultCategories = await this.initializeDefaultCategories();
        return defaultCategories;
      }
      return JSON.parse(categoriesJson);
    } catch (error) {
      console.error('Error getting categories:', error);
      return [];
    }
  }

  async initializeDefaultCategories(): Promise<Category[]> {
    const defaultExpenseCategories = [
      'Food & Dining', 'Transportation', 'Shopping', 'Entertainment',
      'Healthcare', 'Utilities', 'Housing', 'Education', 'Travel', 'Other'
    ];
    
    const defaultIncomeCategories = [
      'Salary', 'Freelance', 'Investment', 'Business', 'Gift', 'Other Income'
    ];

    const categories: Category[] = [];

    // Add expense categories
    defaultExpenseCategories.forEach((name, index) => {
      categories.push({
        id: `expense-${index}`,
        name,
        type: 'expense',
        isCustom: false,
        createdAt: new Date().toISOString()
      });
    });

    // Add income categories
    defaultIncomeCategories.forEach((name, index) => {
      categories.push({
        id: `income-${index}`,
        name,
        type: 'income',
        isCustom: false,
        createdAt: new Date().toISOString()
      });
    });

    await AsyncStorage.setItem(this.CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
    return categories;
  }

  async addCategory(category: Omit<Category, 'id' | 'createdAt'>): Promise<Category> {
    try {
      const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      const newCategory: Category = {
        ...category,
        id,
        createdAt: new Date().toISOString()
      };

      const categories = await this.getCategories();
      const updatedCategories = [...categories, newCategory];
      await AsyncStorage.setItem(this.CATEGORIES_STORAGE_KEY, JSON.stringify(updatedCategories));
      return newCategory;
    } catch (error) {
      console.error('Error adding category:', error);
      throw error;
    }
  }

  async updateCategory(id: string, updates: Partial<Category>): Promise<void> {
    try {
      const categories = await this.getCategories();
      const categoryIndex = categories.findIndex(cat => cat.id === id);
      
      if (categoryIndex === -1) {
        throw new Error('Category not found');
      }

      const oldCategory = categories[categoryIndex];
      const updatedCategory = { ...oldCategory, ...updates };
      categories[categoryIndex] = updatedCategory;

      // If category name changed, update all transactions and goals
      if (updates.name && oldCategory.name !== updates.name) {
        await this.updateCategoryInTransactions(oldCategory.name, updates.name);
        await this.updateCategoryInGoals(oldCategory.name, updates.name);
      }

      await AsyncStorage.setItem(this.CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
    } catch (error) {
      console.error('Error updating category:', error);
      throw error;
    }
  }

  async deleteCategory(id: string): Promise<void> {
    try {
      const categories = await this.getCategories();
      const category = categories.find(cat => cat.id === id);
      
      if (!category) {
        throw new Error('Category not found');
      }

      if (!category.isCustom) {
        throw new Error('Cannot delete default categories');
      }

      // Remove category from list
      const updatedCategories = categories.filter(cat => cat.id !== id);
      
      // Update transactions that use this category to "Other"
      await this.updateCategoryInTransactions(category.name, 'Other');
      
      // Update goals that use this category to "Other"
      await this.updateCategoryInGoals(category.name, 'Other');

      await AsyncStorage.setItem(this.CATEGORIES_STORAGE_KEY, JSON.stringify(updatedCategories));
    } catch (error) {
      console.error('Error deleting category:', error);
      throw error;
    }
  }

  private async updateCategoryInTransactions(oldCategoryName: string, newCategoryName: string): Promise<void> {
    try {
      const transactions = await this.getTransactions();
      const updatedTransactions = transactions.map(transaction => {
        if (transaction.category === oldCategoryName) {
          return { ...transaction, category: newCategoryName };
        }
        return transaction;
      });

      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedTransactions));
    } catch (error) {
      console.error('Error updating category in transactions:', error);
      throw error;
    }
  }

  private async updateCategoryInGoals(oldCategoryName: string, newCategoryName: string): Promise<void> {
    try {
      const goals = await this.getBudgetGoals();
      const updatedGoals = goals.map(goal => {
        if (goal.category === oldCategoryName) {
          return { ...goal, category: newCategoryName };
        }
        return goal;
      });

      await AsyncStorage.setItem(this.GOALS_STORAGE_KEY, JSON.stringify(updatedGoals));
    } catch (error) {
      console.error('Error updating category in goals:', error);
      throw error;
    }
  }

  async clearAllData(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.STORAGE_KEY);
      await AsyncStorage.removeItem(this.GOALS_STORAGE_KEY);
      await AsyncStorage.removeItem(this.CATEGORIES_STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing data:', error);
      throw error;
    }
  }
}

export const databaseService = new DatabaseService(); 
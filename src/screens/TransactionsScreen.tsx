import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { databaseService, Transaction } from '../services/database';
import { useDataContext } from '../context/DataContext';

export default function TransactionsScreen() {
  const { refreshTrigger, triggerRefresh } = useDataContext();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTransactions = async () => {
    try {
      const data = await databaseService.getTransactions(selectedMonth, selectedYear);
      setTransactions(data);
    } catch (error) {
      console.error('Error loading transactions:', error);
      Alert.alert('Error', 'Failed to load transactions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [selectedMonth, selectedYear, refreshTrigger]);

  const onRefresh = () => {
    setRefreshing(true);
    loadTransactions();
  };

  const deleteTransaction = async (id: string) => {
    Alert.alert(
      'Delete Transaction',
      'Are you sure you want to delete this transaction?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await databaseService.deleteTransaction(id);
              triggerRefresh(); // This will refresh all screens including dashboard
            } catch (error) {
              console.error('Error deleting transaction:', error);
              Alert.alert('Error', 'Failed to delete transaction');
            }
          },
        },
      ]
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <View style={styles.transactionItem}>
      <View style={styles.transactionLeft}>
        <View style={styles.transactionHeader}>
          <View
            style={[
              styles.typeBadge,
              item.type === 'income' ? styles.incomeBadge : styles.expenseBadge,
            ]}
          >
            <Text style={styles.typeText}>{item.type.toUpperCase()}</Text>
          </View>
          <Text style={styles.categoryText}>{item.category}</Text>
        </View>
        {item.description && (
          <Text style={styles.descriptionText}>{item.description}</Text>
        )}
        <Text style={styles.dateText}>{formatDate(item.date)}</Text>
      </View>
      <View style={styles.transactionRight}>
        <Text
          style={[
            styles.amountText,
            item.type === 'income' ? styles.incomeAmount : styles.expenseAmount,
          ]}
        >
          {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}
        </Text>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => deleteTransaction(item.id)}
        >
          <Ionicons name="trash-outline" size={20} color="#FF3B30" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="list" size={64} color="#ccc" />
      <Text style={styles.emptyStateText}>No transactions found</Text>
      <Text style={styles.emptyStateSubtext}>
        Add your first transaction using the + button
      </Text>
    </View>
  );

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
      <View style={styles.header}>
        <Text style={styles.title}>Transactions</Text>
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
            {new Date(selectedYear, selectedMonth - 1).toLocaleDateString('en-US', {
              month: 'long',
              year: 'numeric',
            })}
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

      <FlatList
        data={transactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={transactions.length === 0 ? styles.emptyList : undefined}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  list: {
    flex: 1,
  },
  emptyList: {
    flex: 1,
  },
  transactionItem: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginVertical: 5,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  transactionLeft: {
    flex: 1,
  },
  transactionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: 8,
  },
  incomeBadge: {
    backgroundColor: '#d4edda',
  },
  expenseBadge: {
    backgroundColor: '#f8d7da',
  },
  typeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#333',
  },
  categoryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  descriptionText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  dateText: {
    fontSize: 12,
    color: '#999',
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  incomeAmount: {
    color: '#28a745',
  },
  expenseAmount: {
    color: '#dc3545',
  },
  deleteButton: {
    padding: 5,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
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
    textAlign: 'center',
  },
}); 
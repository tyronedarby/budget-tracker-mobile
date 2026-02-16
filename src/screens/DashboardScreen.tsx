import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Dimensions,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, BarChart } from 'react-native-chart-kit';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { databaseService, Transaction } from '../services/database';
import { TransactionStats } from '../types';
import { useDataContext } from '../context/DataContext';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { useTheme } from '../context/ThemeContext';
import { lightColors, darkColors } from '../theme/colors';
import { notificationService } from '../services/notificationService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

export default function DashboardScreen() {
  const dataContext = useDataContext();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isDarkMode } = useTheme();
  const colors = isDarkMode ? darkColors : lightColors;
  
  const [stats, setStats] = useState<TransactionStats>({
    totalIncome: 0,
    totalExpense: 0,
    netBalance: 0,
    expensesByCategory: {},
  });
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [budgetAlerts, setBudgetAlerts] = useState<{
    exceededGoals: Array<{
      goal: any;
      currentSpending: number;
      percentage: number;
    }>;
    warningGoals: Array<{
      goal: any;
      currentSpending: number;
      percentage: number;
    }>;
  }>({ exceededGoals: [], warningGoals: [] });
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    type: 'exceeded' | 'warning';
    category: string;
    goalAmount: number;
    currentSpending: number;
    percentage: number;
    date: string;
  }>>([]);

  const [lineChartData, setLineChartData] = useState<{
    labels: string[];
    datasets: Array<{ data: number[] }>;
  }>({
    labels: [],
    datasets: [{ data: [] }],
  });

  const [barChartData, setBarChartData] = useState<{
    labels: string[];
    datasets: Array<{ data: number[] }>;
  }>({
    labels: [],
    datasets: [{ data: [] }],
  });

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Safety check for context
  if (!dataContext) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: colors.text }}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  const { refreshTrigger } = dataContext;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // SVG Chart Generation Functions
  const generatePieChartSVG = (labels: string[], data: number[], colors: string[]) => {
    const width = 600;
    const height = 400;
    const radius = Math.min(width, height) / 2 - 80;
    const centerX = width / 2;
    const centerY = height / 2 - 30;

    let total = data.reduce((sum, value) => sum + value, 0);
    let currentAngle = -Math.PI / 2;

    const slices = data.map((value, index) => {
      const sliceAngle = (value / total) * 2 * Math.PI;
      const startAngle = currentAngle;
      const endAngle = currentAngle + sliceAngle;
      
      const x1 = centerX + radius * Math.cos(startAngle);
      const y1 = centerY + radius * Math.sin(startAngle);
      const x2 = centerX + radius * Math.cos(endAngle);
      const y2 = centerY + radius * Math.sin(endAngle);
      
      const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;
      
      const path = [
        `M ${centerX} ${centerY}`,
        `L ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
        'Z'
      ].join(' ');

      currentAngle = endAngle;
      
      return `<path d="${path}" fill="${colors[index]}" stroke="#fff" stroke-width="3"/>`;
    }).join('');

    // Create a proper color key with colored squares
    const legendItems = labels.map((label, index) => {
      const y = 25 + index * 30;
      const percentage = ((data[index] / total) * 100).toFixed(1);
      const amount = formatCurrency(data[index]);
      
      return `
        <rect x="15" y="${y - 10}" width="15" height="15" fill="${colors[index]}" stroke="#333" stroke-width="1"/>
        <text x="40" y="${y + 2}" font-size="13" fill="#333" font-weight="bold" font-family="Arial, sans-serif">${label}</text>
        <text x="40" y="${y + 18}" font-size="11" fill="#666" font-family="Arial, sans-serif">${percentage}% (${amount})</text>
      `;
    }).join('');

    return `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <text x="${width / 2}" y="25" text-anchor="middle" font-size="16" font-weight="bold" fill="#333" font-family="Arial, sans-serif">Expense Breakdown</text>
        ${slices}
        <g transform="translate(0, ${height - 150})">
          <text x="15" y="15" font-size="15" font-weight="bold" fill="#333" font-family="Arial, sans-serif">Category Breakdown:</text>
          ${legendItems}
        </g>
      </svg>
    `;
  };

  const generateLineChartSVG = (labels: string[], data: number[]) => {
    const width = 600;
    const height = 300;
    const padding = 60;
    const chartWidth = width - 2 * padding;
    const chartHeight = height - 2 * padding;
    
    const maxValue = Math.max(...data);
    const minValue = Math.min(...data);
    const range = maxValue - minValue || 1;
    
    // Generate grid lines
    const gridLines = [];
    for (let i = 0; i <= 5; i++) {
      const y = padding + (i / 5) * chartHeight;
      gridLines.push(`<line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" stroke="#e0e0e0" stroke-width="1"/>`);
    }
    
    // Generate axis labels
    const axisLabels = data.map((value, index) => {
      const x = padding + (index / (data.length - 1)) * chartWidth;
      const y = height - 15;
      return `<text x="${x}" y="${y}" text-anchor="middle" font-size="12" fill="#666" font-family="Arial, sans-serif">${labels[index]}</text>`;
    }).join('');
    
    // Generate value labels on Y-axis
    const valueLabels = [];
    for (let i = 0; i <= 5; i++) {
      const value = maxValue - (i / 5) * range;
      const y = padding + (i / 5) * chartHeight;
      const formattedValue = formatCurrency(value);
      valueLabels.push(`<text x="${padding - 10}" y="${y + 4}" text-anchor="end" font-size="10" fill="#666" font-family="Arial, sans-serif">${formattedValue}</text>`);
    }
    
    // Generate data points and line
    const points = data.map((value, index) => {
      const x = padding + (index / (data.length - 1)) * chartWidth;
      const y = height - padding - ((value - minValue) / range) * chartHeight;
      return `${x},${y}`;
    }).join(' ');
    
    // Generate data point circles
    const dataPoints = data.map((value, index) => {
      const x = padding + (index / (data.length - 1)) * chartWidth;
      const y = height - padding - ((value - minValue) / range) * chartHeight;
      return `<circle cx="${x}" cy="${y}" r="5" fill="#007AFF" stroke="#fff" stroke-width="2"/>`;
    }).join('');
    
    return `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:#007AFF;stop-opacity:0.3" />
            <stop offset="100%" style="stop-color:#007AFF;stop-opacity:0.1" />
          </linearGradient>
        </defs>
        ${gridLines.join('')}
        <polygon points="${points} ${width - padding},${height - padding} ${padding},${height - padding}" fill="url(#lineGradient)"/>
        <polyline fill="none" stroke="#007AFF" stroke-width="3" points="${points}"/>
        ${dataPoints}
        ${axisLabels}
        ${valueLabels.join('')}
        <text x="${width / 2}" y="${height - 5}" text-anchor="middle" font-size="14" font-weight="bold" fill="#333" font-family="Arial, sans-serif">Monthly Expenses</text>
      </svg>
    `;
  };

  const generateComparisonChartSVG = (labels: string[], incomeData: number[], expenseData: number[]) => {
    const width = 600;
    const height = 300;
    const padding = 60;
    const chartWidth = width - 2 * padding;
    const chartHeight = height - 2 * padding;
    
    const maxValue = Math.max(...incomeData, ...expenseData);
    const minValue = 0;
    const range = maxValue - minValue || 1;
    
    // Generate grid lines
    const gridLines = [];
    for (let i = 0; i <= 5; i++) {
      const y = padding + (i / 5) * chartHeight;
      gridLines.push(`<line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" stroke="#e0e0e0" stroke-width="1"/>`);
    }
    
    // Generate axis labels
    const axisLabels = labels.map((label, index) => {
      const x = padding + (index / (labels.length - 1)) * chartWidth;
      const y = height - 15;
      return `<text x="${x}" y="${y}" text-anchor="middle" font-size="12" fill="#666" font-family="Arial, sans-serif">${label}</text>`;
    }).join('');
    
    // Generate value labels on Y-axis
    const valueLabels = [];
    for (let i = 0; i <= 5; i++) {
      const value = maxValue - (i / 5) * range;
      const y = padding + (i / 5) * chartHeight;
      const formattedValue = formatCurrency(value);
      valueLabels.push(`<text x="${padding - 10}" y="${y + 4}" text-anchor="end" font-size="10" fill="#666" font-family="Arial, sans-serif">${formattedValue}</text>`);
    }
    
    const incomePoints = incomeData.map((value, index) => {
      const x = padding + (index / (incomeData.length - 1)) * chartWidth;
      const y = height - padding - ((value - minValue) / range) * chartHeight;
      return `${x},${y}`;
    }).join(' ');
    
    const expensePoints = expenseData.map((value, index) => {
      const x = padding + (index / (expenseData.length - 1)) * chartWidth;
      const y = height - padding - ((value - minValue) / range) * chartHeight;
      return `${x},${y}`;
    }).join(' ');
    
    // Generate data point circles
    const incomeDataPoints = incomeData.map((value, index) => {
      const x = padding + (index / (incomeData.length - 1)) * chartWidth;
      const y = height - padding - ((value - minValue) / range) * chartHeight;
      return `<circle cx="${x}" cy="${y}" r="4" fill="#34C759" stroke="#fff" stroke-width="2"/>`;
    }).join('');
    
    const expenseDataPoints = expenseData.map((value, index) => {
      const x = padding + (index / (expenseData.length - 1)) * chartWidth;
      const y = height - padding - ((value - minValue) / range) * chartHeight;
      return `<circle cx="${x}" cy="${y}" r="4" fill="#FF3B30" stroke="#fff" stroke-width="2"/>`;
    }).join('');
    
    return `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        ${gridLines.join('')}
        <polyline fill="none" stroke="#34C759" stroke-width="3" points="${incomePoints}"/>
        <polyline fill="none" stroke="#FF3B30" stroke-width="3" points="${expensePoints}"/>
        ${incomeDataPoints}
        ${expenseDataPoints}
        ${axisLabels}
        ${valueLabels.join('')}
        <text x="${width / 2}" y="${height - 5}" text-anchor="middle" font-size="14" font-weight="bold" fill="#333" font-family="Arial, sans-serif">Income vs Expenses</text>
        <circle cx="${width - 100}" cy="30" r="6" fill="#34C759"/>
        <text x="${width - 85}" y="35" font-size="12" fill="#34C759" font-family="Arial, sans-serif">Income</text>
        <circle cx="${width - 100}" cy="50" r="6" fill="#FF3B30"/>
        <text x="${width - 85}" y="55" font-size="12" fill="#FF3B30" font-family="Arial, sans-serif">Expenses</text>
      </svg>
    `;
  };

  const getMonthlySpendingData = async (months: number = 6) => {
    const data = [];
    const currentDate = new Date();
    
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      
      const transactions = await databaseService.getTransactions(month, year);
      const income = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      const expenses = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
      
      data.push({
        month: monthNames[month - 1],
        income,
        expenses,
      });
    }
    
    return data;
  };

  const loadStats = async () => {
    try {
      setLoading(true);
      const [statsData, alertsData] = await Promise.all([
        databaseService.getTransactionStats(selectedMonth, selectedYear),
        databaseService.checkBudgetAlerts(selectedMonth, selectedYear),
      ]);
      setStats(statsData);
      setBudgetAlerts(alertsData);
      
      // Generate notifications from alerts
      await generateNotifications(alertsData.exceededGoals, alertsData.warningGoals);
    } catch (error) {
      console.error('Error loading stats:', error);
      Alert.alert('Error', 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const generateNotifications = async (exceededGoals: any[], warningGoals: any[]) => {
    const newNotifications: Array<{
      id: string;
      type: 'exceeded' | 'warning';
      category: string;
      goalAmount: number;
      currentSpending: number;
      percentage: number;
      date: string;
    }> = [];

    // Check if notifications are enabled
    const notificationsEnabled = await AsyncStorage.getItem('notifications_enabled');
    const shouldSendPushNotifications = notificationsEnabled === 'true';

    // Add exceeded goal notifications
    exceededGoals.forEach(async (alert, index) => {
      newNotifications.push({
        id: `exceeded-${index}`,
        type: 'exceeded',
        category: alert.goal.category,
        goalAmount: alert.goal.amount,
        currentSpending: alert.currentSpending,
        percentage: alert.percentage,
        date: new Date().toISOString(),
      });

      // Send push notification for exceeded budget
      if (shouldSendPushNotifications) {
        await notificationService.scheduleBudgetExceededAlert(
          alert.goal.category,
          alert.currentSpending,
          alert.goal.amount
        );
      }
    });

    // Add warning goal notifications
    warningGoals.forEach(async (alert, index) => {
      newNotifications.push({
        id: `warning-${index}`,
        type: 'warning',
        category: alert.goal.category,
        goalAmount: alert.goal.amount,
        currentSpending: alert.currentSpending,
        percentage: alert.percentage,
        date: new Date().toISOString(),
      });

      // Send push notification for budget warning (only for 80%+ usage)
      if (shouldSendPushNotifications && alert.percentage >= 80) {
        await notificationService.scheduleBudgetWarningAlert(
          alert.goal.category,
          alert.currentSpending,
          alert.goal.amount,
          alert.percentage
        );
      }
    });

    setNotifications(newNotifications);
  };

  useEffect(() => {
    loadStats();
  }, [selectedMonth, selectedYear, refreshTrigger]);

  const generatePDF = async (period: 'monthly' | 'annual') => {
    try {
      let transactions, reportStats, reportTitle;
      
      if (period === 'monthly') {
        transactions = await databaseService.getTransactions(selectedMonth, selectedYear);
        reportStats = stats;
        reportTitle = `${monthNames[selectedMonth - 1]} ${selectedYear} Budget Report`;
      } else {
        // For annual report, get all transactions for the year
        const allYearTransactions = [];
        for (let month = 1; month <= 12; month++) {
          const monthTransactions = await databaseService.getTransactions(month, selectedYear);
          allYearTransactions.push(...monthTransactions);
        }
        transactions = allYearTransactions;
        
        // Calculate annual stats
        const annualIncome = allYearTransactions
          .filter(t => t.type === 'income')
          .reduce((sum, t) => sum + t.amount, 0);
        const annualExpenses = allYearTransactions
          .filter(t => t.type === 'expense')
          .reduce((sum, t) => sum + t.amount, 0);
        
        const annualExpensesByCategory: Record<string, number> = {};
        allYearTransactions
          .filter(t => t.type === 'expense')
          .forEach(t => {
            annualExpensesByCategory[t.category] = (annualExpensesByCategory[t.category] || 0) + t.amount;
          });
        
        reportStats = {
          totalIncome: annualIncome,
          totalExpense: annualExpenses,
          netBalance: annualIncome - annualExpenses,
          expensesByCategory: annualExpensesByCategory,
        };
        
        reportTitle = `${selectedYear} Annual Budget Report`;
      }

      // Get monthly data for comparison chart (12 months for annual, 6 for monthly)
      const monthsToShow = period === 'annual' ? 12 : 6;
      const monthlyData = await getMonthlySpendingData(monthsToShow);
      const monthlyLabels = monthlyData.map(d => d.month);
      const monthlyIncome = monthlyData.map(d => d.income);
      const monthlyExpenses = monthlyData.map(d => d.expenses);

      // Prepare chart data for PDF
      const chartLabels = Object.keys(reportStats.expensesByCategory);
      const chartData = Object.values(reportStats.expensesByCategory);
      const chartColors = chartLabels.map((_, index) => 
        `hsl(${index * 60}, 70%, 50%)`
      );

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>${reportTitle}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f8f9fa; }
            .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #1a1a1a; text-align: center; margin-bottom: 30px; font-size: 28px; }
            .summary { display: flex; justify-content: space-between; margin-bottom: 30px; }
            .summary-item { flex: 1; text-align: center; padding: 20px; margin: 0 10px; border-radius: 8px; }
            .income { background: #e8f5e8; color: #2d5a2d; }
            .expense { background: #ffe8e8; color: #5a2d2d; }
            .balance { background: #e8f0ff; color: #2d4a5a; }
            .amount { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
            .label { font-size: 14px; opacity: 0.8; }
            .chart-container { margin: 30px 0; text-align: center; }
            .chart-title { font-size: 18px; font-weight: bold; margin-bottom: 15px; color: #1a1a1a; }
            .chart-wrapper { display: flex; justify-content: center; margin: 20px 0; }
            .chart-wrapper svg { max-width: 100%; height: auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 10px; background: white; }
            .transactions { margin-top: 30px; }
            .transactions h2 { color: #1a1a1a; margin-bottom: 20px; font-size: 20px; }
            .transaction-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            .transaction-table th { background: #f8f9fa; padding: 12px 8px; text-align: left; font-weight: 600; color: #1a1a1a; border-bottom: 2px solid #e5e5e5; }
            .transaction-table th:first-child { background: #e8f0ff; color: #1a4a8a; font-weight: 700; }
            .transaction-table td { padding: 12px 8px; border-bottom: 1px solid #eee; }
            .transaction-table tr:hover { background: #f8f9fa; }
            .transaction-category { font-weight: bold; color: #1a1a1a; }
            .transaction-description { color: #666; font-size: 14px; }
            .transaction-amount { font-weight: bold; text-align: right; }
            .income-amount { color: #34C759; }
            .expense-amount { color: #FF3B30; }
            .date { color: #333; font-size: 13px; font-weight: 500; background: #f0f0f0; padding: 4px 8px; border-radius: 4px; border: 1px solid #ddd; }
            .type-badge { padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
            .type-income { background: #e8f5e8; color: #2d5a2d; }
            .type-expense { background: #ffe8e8; color: #5a2d2d; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>${reportTitle}</h1>
            
            <div class="summary">
              <div class="summary-item income">
                <div class="amount">${formatCurrency(reportStats.totalIncome)}</div>
                <div class="label">Total Income</div>
              </div>
              <div class="summary-item expense">
                <div class="amount">${formatCurrency(reportStats.totalExpense)}</div>
                <div class="label">Total Expenses</div>
              </div>
              <div class="summary-item balance">
                <div class="amount">${formatCurrency(reportStats.netBalance)}</div>
                <div class="label">Net Balance</div>
              </div>
            </div>

            <div class="chart-container">
              <div class="chart-title">Expense Breakdown</div>
              <div class="chart-wrapper">
                ${generatePieChartSVG(chartLabels, chartData, chartColors)}
              </div>
            </div>

            <div class="chart-container">
              <div class="chart-title">Monthly Trend</div>
              <div class="chart-wrapper">
                ${generateLineChartSVG(monthlyLabels, monthlyExpenses)}
              </div>
            </div>

            <div class="chart-container">
              <div class="chart-title">6-Month Income vs Expenses Comparison</div>
              <div class="chart-wrapper">
                ${generateComparisonChartSVG(monthlyLabels, monthlyIncome, monthlyExpenses)}
              </div>
            </div>

            <div class="transactions">
              <h2>All Transactions (${transactions.length})</h2>
              <table class="transaction-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${transactions.map(t => {
                    const date = new Date(t.date);
                    const formattedDate = date.toLocaleDateString('en-US', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    });
                    return `
                      <tr>
                        <td class="date">${formattedDate}</td>
                        <td>
                          <span class="type-badge ${t.type === 'income' ? 'type-income' : 'type-expense'}">
                            ${t.type}
                          </span>
                        </td>
                        <td class="transaction-category">${t.category}</td>
                        <td class="transaction-description">${t.description || '-'}</td>
                        <td class="transaction-amount ${t.type === 'income' ? 'income-amount' : 'expense-amount'}">
                          ${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: reportTitle,
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      Alert.alert('Error', 'Failed to generate PDF report');
    }
  };

  const loadChartData = async () => {
    try {
      const monthlyData = await getMonthlySpendingData(12); // Show 12 months for better scrolling
      const labels = monthlyData.map(d => d.month);
      const expenses = monthlyData.map(d => d.expenses);
      
      setLineChartData({
        labels,
        datasets: [{ data: expenses }],
      });

      // Prepare bar chart data for all categories
      const categoryData = Object.entries(stats.expensesByCategory)
        .sort(([, a], [, b]) => b - a)
        .filter(([, amount]) => amount > 0); // Only show categories with expenses
      
      setBarChartData({
        labels: categoryData.map(([category]) => category),
        datasets: [{ data: categoryData.map(([, amount]) => amount) }],
      });
    } catch (error) {
      console.error('Error loading chart data:', error);
    }
  };

  useEffect(() => {
    if (!loading) {
      loadChartData();
    }
  }, [stats, loading]);

  const chartConfig = {
    backgroundColor: colors.surface,
    backgroundGradientFrom: colors.surface,
    backgroundGradientTo: colors.surface,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
    labelColor: (opacity = 1) => colors.text,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: colors.primary,
    },
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: colors.text }}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Define styles with dynamic colors
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      fontSize: 16,
      color: colors.textSecondary,
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
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerButton: {
      padding: 8,
      marginRight: 10,
    },
    notificationContainer: {
      position: 'relative',
    },
    notificationBadge: {
      position: 'absolute',
      top: -5,
      right: -5,
      backgroundColor: colors.error,
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.surface,
    },
    notificationBadgeText: {
      color: colors.textInverse,
      fontSize: 12,
      fontWeight: 'bold',
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
    },
    scrollView: {
      flex: 1,
      paddingBottom: 100, // Add extra padding to avoid navigation overlap
    },
    gettingStartedCard: {
      backgroundColor: colors.surface,
      margin: 20,
      padding: 20,
      borderRadius: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    gettingStartedTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 5,
      textAlign: 'center',
    },
    gettingStartedSubtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      marginBottom: 20,
    },
    progressBar: {
      flexDirection: 'row',
      marginBottom: 20,
    },
    progressSegment: {
      flex: 1,
      height: 4,
      marginHorizontal: 2,
      borderRadius: 2,
      justifyContent: 'center',
      alignItems: 'center',
    },
    progressCompleted: {
      backgroundColor: colors.success,
    },
    progressPending: {
      backgroundColor: colors.border,
    },
    setupTasks: {
      marginBottom: 15,
    },
    setupTask: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
    },
    taskIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.borderLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    taskText: {
      flex: 1,
      fontSize: 16,
      color: colors.text,
    },
    taskStatus: {
      marginLeft: 10,
    },
    pendingCircle: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.border,
    },
    hideWidgetButton: {
      alignSelf: 'flex-start',
    },
    hideWidgetText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: '500',
    },
    monthSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      marginBottom: 20,
    },
    monthText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    summaryContainer: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      marginBottom: 20,
    },
    summaryCard: {
      flex: 1,
      backgroundColor: colors.surface,
      padding: 15,
      marginHorizontal: 5,
      borderRadius: 12,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    summaryLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 5,
    },
    summaryAmount: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    chartContainer: {
      backgroundColor: colors.surface,
      margin: 20,
      padding: 20,
      borderRadius: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    chartTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 15,
    },
    chart: {
      borderRadius: 8,
    },
    lineChartScrollView: {
      maxHeight: 240,
    },
    lineChartScrollContent: {
      alignItems: 'center',
      paddingHorizontal: 10,
    },
    barChartScrollView: {
      maxHeight: 240,
    },
    barChartScrollContent: {
      alignItems: 'center',
      paddingHorizontal: 10,
    },
    alertsContainer: {
      backgroundColor: colors.surface,
      margin: 20,
      padding: 20,
      borderRadius: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    alertsTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 15,
    },
    alertItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    alertIcon: {
      marginRight: 12,
    },
    alertContent: {
      flex: 1,
    },
    alertTitle: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
      marginBottom: 4,
    },
    alertDetails: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    exportContainer: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      marginBottom: 20,
    },
    exportButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      padding: 15,
      marginHorizontal: 5,
      borderRadius: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    exportButtonSecondary: {
      backgroundColor: colors.successLight,
    },
    exportButtonText: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.primary,
      marginLeft: 8,
    },
    exportButtonTextSecondary: {
      color: colors.success,
    },
    // Modal styles
    modalContainer: {
      flex: 1,
      backgroundColor: colors.modalBackground,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 15,
      backgroundColor: colors.modalSurface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalCloseButton: {
      padding: 5,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    modalSpacer: {
      width: 34,
    },
    modalContent: {
      flex: 1,
      padding: 20,
    },
    emptyNotifications: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 60,
    },
    emptyNotificationsTitle: {
      fontSize: 24,
      fontWeight: '600',
      color: colors.text,
      marginTop: 20,
      marginBottom: 10,
    },
    emptyNotificationsSubtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    notificationItem: {
      flexDirection: 'row',
      backgroundColor: colors.modalSurface,
      padding: 16,
      marginBottom: 12,
      borderRadius: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    notificationExceeded: {
      borderLeftWidth: 4,
      borderLeftColor: colors.error,
    },
    notificationWarning: {
      borderLeftWidth: 4,
      borderLeftColor: colors.warning,
    },
    notificationIcon: {
      marginRight: 12,
      marginTop: 2,
    },
    notificationContent: {
      flex: 1,
    },
    notificationTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    notificationCategory: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.primary,
      marginBottom: 4,
    },
    notificationDetails: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    notificationTime: {
      fontSize: 12,
      color: colors.textTertiary,
    },
    // Alert styles
    exceededAlert: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    warningAlert: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    alertCategory: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
      marginBottom: 4,
    },
    alertText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => setShowNotifications(true)}
          >
            <View style={styles.notificationContainer}>
              <Ionicons name="notifications-outline" size={24} color={colors.text} />
              {notifications.length > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {notifications.length > 9 ? '9+' : notifications.length}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>
        <Text style={styles.headerTitle}>Dashboard</Text>
        <TouchableOpacity 
          style={styles.headerButton}
          onPress={() => navigation.navigate('Settings')}
        >
          <Ionicons name="settings-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Welcome Widget */}
        <View style={styles.gettingStartedCard}>
          <Text style={styles.gettingStartedTitle}>Welcome to Our Budget Management System</Text>
        </View>

        {/* Month Selector */}
        <View style={styles.monthSelector}>
          <TouchableOpacity
            onPress={() => {
              if (selectedMonth === 1) {
                setSelectedMonth(12);
                setSelectedYear(selectedYear - 1);
              } else {
                setSelectedMonth(selectedMonth - 1);
              }
            }}
          >
            <Ionicons name="chevron-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.monthText}>{monthNames[selectedMonth - 1]} {selectedYear}</Text>
          <TouchableOpacity
            onPress={() => {
              if (selectedMonth === 12) {
                setSelectedMonth(1);
                setSelectedYear(selectedYear + 1);
              } else {
                setSelectedMonth(selectedMonth + 1);
              }
            }}
          >
            <Ionicons name="chevron-forward" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Financial Summary */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Income</Text>
            <Text style={styles.summaryAmount}>{formatCurrency(stats.totalIncome)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Expenses</Text>
            <Text style={styles.summaryAmount}>{formatCurrency(stats.totalExpense)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Balance</Text>
            <Text style={[styles.summaryAmount, { color: stats.netBalance >= 0 ? colors.success : colors.error }]}>
              {formatCurrency(stats.netBalance)}
            </Text>
          </View>
        </View>

        {/* Charts */}
        {lineChartData.labels.length > 0 && (
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Expense Trends</Text>
            <ScrollView 
              horizontal={true} 
              showsHorizontalScrollIndicator={true}
              style={styles.lineChartScrollView}
              contentContainerStyle={styles.lineChartScrollContent}
            >
              <LineChart
                data={lineChartData}
                width={Math.max(width - 40, lineChartData.labels.length * 60)} // Minimum 60px per data point
                height={220}
                chartConfig={chartConfig}
                bezier
                style={styles.chart}
              />
            </ScrollView>
          </View>
        )}

        {barChartData.labels.length > 0 && (
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Expense Categories</Text>
            <ScrollView 
              horizontal={true} 
              showsHorizontalScrollIndicator={true}
              style={styles.barChartScrollView}
              contentContainerStyle={styles.barChartScrollContent}
            >
              <BarChart
                data={barChartData}
                width={Math.max(width - 40, barChartData.labels.length * 80)} // Minimum 80px per category
                height={220}
                chartConfig={chartConfig}
                yAxisLabel="$"
                yAxisSuffix=""
                style={styles.chart}
              />
            </ScrollView>
          </View>
        )}

        {/* Budget Alerts */}
        {(budgetAlerts.exceededGoals.length > 0 || budgetAlerts.warningGoals.length > 0) && (
          <View style={styles.alertsContainer}>
            <Text style={styles.alertsTitle}>Budget Alerts</Text>
            
            {budgetAlerts.exceededGoals.map((alert, index) => (
              <View key={index} style={styles.exceededAlert}>
                <View style={styles.alertContent}>
                  <Text style={styles.alertCategory}>{alert.goal.category}</Text>
                  <Text style={styles.alertText}>
                    Exceeded by {formatCurrency(alert.currentSpending - alert.goal.amount)} ({alert.percentage.toFixed(1)}%)
                  </Text>
                </View>
                <Ionicons name="warning" size={20} color={colors.error} />
              </View>
            ))}

            {budgetAlerts.warningGoals.map((alert, index) => (
              <View key={index} style={styles.warningAlert}>
                <View style={styles.alertContent}>
                  <Text style={styles.alertCategory}>{alert.goal.category}</Text>
                  <Text style={styles.alertText}>
                    {alert.percentage.toFixed(1)}% of budget used
                  </Text>
                </View>
                <Ionicons name="alert-circle" size={20} color={colors.warning} />
              </View>
            ))}
          </View>
        )}

        {/* Export Buttons */}
        <View style={styles.exportContainer}>
          <TouchableOpacity
            style={styles.exportButton}
            onPress={() => generatePDF('monthly')}
          >
            <Ionicons name="document-text" size={20} color={colors.primary} />
            <Text style={styles.exportButtonText}>Export Monthly Report</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.exportButton, styles.exportButtonSecondary]}
            onPress={() => generatePDF('annual')}
          >
            <Ionicons name="calendar" size={20} color={colors.success} />
            <Text style={[styles.exportButtonText, styles.exportButtonTextSecondary]}>Export Annual Report</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Notifications Modal */}
      <Modal
        visible={showNotifications}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowNotifications(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setShowNotifications(false)}
            >
              <Ionicons name="close" size={24} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Notifications</Text>
            <View style={styles.modalSpacer} />
          </View>

          <ScrollView style={styles.modalContent}>
            {notifications.length === 0 ? (
              <View style={styles.emptyNotifications}>
                <Ionicons name="checkmark-circle" size={64} color={colors.success} />
                <Text style={styles.emptyNotificationsTitle}>All Good!</Text>
                <Text style={styles.emptyNotificationsSubtitle}>
                  No budget alerts at the moment. Keep up the great work!
                </Text>
              </View>
            ) : (
              notifications.map((notification) => (
                <View 
                  key={notification.id} 
                  style={[
                    styles.notificationItem,
                    notification.type === 'exceeded' ? styles.notificationExceeded : styles.notificationWarning
                  ]}
                >
                  <View style={styles.notificationIcon}>
                    <Ionicons 
                      name={notification.type === 'exceeded' ? 'warning' : 'alert-circle'} 
                      size={24} 
                      color={notification.type === 'exceeded' ? colors.error : colors.warning} 
                    />
                  </View>
                  <View style={styles.notificationContent}>
                    <Text style={styles.notificationTitle}>
                      {notification.type === 'exceeded' ? 'Budget Exceeded' : 'Budget Warning'}
                    </Text>
                    <Text style={styles.notificationCategory}>
                      {notification.category}
                    </Text>
                    <Text style={styles.notificationDetails}>
                      Spent {formatCurrency(notification.currentSpending)} of {formatCurrency(notification.goalAmount)} 
                      ({notification.percentage.toFixed(1)}%)
                    </Text>
                    <Text style={styles.notificationTime}>
                      {new Date(notification.date).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
} 
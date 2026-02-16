import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export interface NotificationData {
  title: string;
  body: string;
  data?: any;
}

class NotificationService {
  private expoPushToken: string | null = null;

  async initialize(): Promise<void> {
    try {
      // Check if notifications are enabled in settings
      const notificationsEnabled = await AsyncStorage.getItem('notifications_enabled');
      if (notificationsEnabled === 'false') {
        console.log('Notifications disabled in settings');
        return;
      }

      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Notification permission not granted');
        return;
      }

      // Get push token for Expo push notifications (only if permissions are granted)
      if (Platform.OS !== 'web') {
        try {
          // For local development, we'll skip the push token since it requires EAS project setup
          // The local notifications will still work without this
          const tokenResponse = await Notifications.getExpoPushTokenAsync({
            projectId: 'budget-tracker-mobile-local'
          });
          this.expoPushToken = tokenResponse.data;
          console.log('Expo push token obtained successfully');
        } catch (tokenError) {
          console.log('Push token not available in development mode - local notifications will still work');
          // This is expected in development mode without EAS setup
        }
      }

      // Configure notification channels for Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('budget-alerts', {
          name: 'Budget Alerts',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#007AFF',
          sound: 'default',
        });

        await Notifications.setNotificationChannelAsync('budget-reminders', {
          name: 'Budget Reminders',
          importance: Notifications.AndroidImportance.DEFAULT,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#007AFF',
          sound: 'default',
        });
      }

      console.log('Notification service initialized successfully');
    } catch (error) {
      console.error('Error initializing notifications:', error);
      // Don't throw the error - app should continue working even if notifications fail
    }
  }

  async requestPermissions(): Promise<boolean> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      return finalStatus === 'granted';
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }

  async getPermissionStatus(): Promise<string> {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status;
    } catch (error) {
      console.error('Error getting permission status:', error);
      return 'undetermined';
    }
  }

  async scheduleLocalNotification(
    notificationData: NotificationData,
    trigger?: Notifications.NotificationTriggerInput
  ): Promise<string | null> {
    try {
      // Check if notifications are enabled
      const notificationsEnabled = await AsyncStorage.getItem('notifications_enabled');
      if (notificationsEnabled === 'false') {
        return null;
      }

      const permissions = await this.getPermissionStatus();
      if (permissions !== 'granted') {
        console.log('Notifications not permitted');
        return null;
      }

      // Determine appropriate channel based on notification type
      const notificationType = notificationData.data?.type || 'general';
      let channelId = 'default';
      
      if (Platform.OS === 'android') {
        if (notificationType === 'budget_exceeded' || notificationType === 'budget_warning') {
          channelId = 'budget-alerts';
        } else if (notificationType === 'weekly_reminder' || notificationType === 'monthly_reminder') {
          channelId = 'budget-reminders';
        }
      }

      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: notificationData.title,
          body: notificationData.body,
          data: notificationData.data || {},
          sound: 'default',
          ...(Platform.OS === 'android' && { channelId }),
        },
        trigger: trigger || null,
      });

      console.log('Notification scheduled successfully:', identifier);
      return identifier;
    } catch (error) {
      console.error('Error scheduling notification:', error);
      return null;
    }
  }

  async scheduleBudgetExceededAlert(category: string, spent: number, budget: number): Promise<void> {
    await this.scheduleLocalNotification({
      title: '🚨 Budget Exceeded!',
      body: `You've spent $${spent.toFixed(2)} on ${category}, exceeding your budget of $${budget.toFixed(2)}.`,
      data: {
        type: 'budget_exceeded',
        category,
        spent,
        budget,
      },
    });
  }

  async scheduleBudgetWarningAlert(category: string, spent: number, budget: number, percentage: number): Promise<void> {
    await this.scheduleLocalNotification({
      title: '⚠️ Budget Warning',
      body: `You've used ${percentage.toFixed(0)}% of your ${category} budget ($${spent.toFixed(2)} of $${budget.toFixed(2)}).`,
      data: {
        type: 'budget_warning',
        category,
        spent,
        budget,
        percentage,
      },
    });
  }

  async scheduleWeeklyBudgetReminder(): Promise<void> {
    // Cancel existing weekly reminders
    await this.cancelScheduledNotifications('weekly_reminder');

    // Schedule for every Sunday at 9 AM
    await this.scheduleLocalNotification(
      {
        title: '📊 Weekly Budget Check',
        body: 'Time to review your spending and plan for the week ahead!',
        data: {
          type: 'weekly_reminder',
        },
      },
      {
        weekday: 1, // Sunday
        hour: 9,
        minute: 0,
        repeats: true,
      }
    );
  }

  async scheduleMonthlyBudgetReminder(): Promise<void> {
    // Cancel existing monthly reminders
    await this.cancelScheduledNotifications('monthly_reminder');

    // Schedule for the 1st of every month at 10 AM
    await this.scheduleLocalNotification(
      {
        title: '📅 Monthly Budget Reset',
        body: 'New month, new budget! Set your goals and track your progress.',
        data: {
          type: 'monthly_reminder',
        },
      },
      {
        day: 1,
        hour: 10,
        minute: 0,
        repeats: true,
      }
    );
  }

  async cancelScheduledNotifications(type?: string): Promise<void> {
    try {
      if (type) {
        // Cancel specific type of notifications
        const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
        const notificationsToCancel = scheduledNotifications.filter(
          notification => notification.content.data?.type === type
        );
        
        for (const notification of notificationsToCancel) {
          await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        }
      } else {
        // Cancel all scheduled notifications
        await Notifications.cancelAllScheduledNotificationsAsync();
      }
    } catch (error) {
      console.error('Error cancelling notifications:', error);
    }
  }

  async getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    try {
      return await Notifications.getAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Error getting scheduled notifications:', error);
      return [];
    }
  }

  getExpoPushToken(): string | null {
    return this.expoPushToken;
  }

  // Add notification listeners
  addNotificationReceivedListener(listener: (notification: Notifications.Notification) => void) {
    return Notifications.addNotificationReceivedListener(listener);
  }

  addNotificationResponseReceivedListener(listener: (response: Notifications.NotificationResponse) => void) {
    return Notifications.addNotificationResponseReceivedListener(listener);
  }
}

export const notificationService = new NotificationService();

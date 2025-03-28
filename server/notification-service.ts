import { Request, Response } from 'express';
import { storage } from './storage.ts';
import { notifications, notificationTypes } from '@shared/schema.ts';

// Get notifications for the current user
export async function getNotifications(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'You must be logged in to access notifications' });
    }

    const notificationsList = await storage.getNotifications(userId);
    res.json(notificationsList);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Failed to fetch notifications', error: (error as Error).message });
  }
}

// Mark a notification as read
export async function markNotificationAsRead(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'You must be logged in to access notifications' });
    }

    const { notificationId } = req.params;
    if (!notificationId) {
      return res.status(400).json({ message: 'Notification ID is required' });
    }

    const notification = await storage.markNotificationAsRead(parseInt(notificationId));
    res.json(notification);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Failed to mark notification as read', error: (error as Error).message });
  }
}

// Mark all notifications as read
export async function markAllNotificationsAsRead(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'You must be logged in to access notifications' });
    }

    await storage.markAllNotificationsAsRead(userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ message: 'Failed to mark all notifications as read', error: (error as Error).message });
  }
}

// Create a notification
export async function createNotification(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'You must be logged in to create notifications' });
    }

    const { title, message, type, recipientId, linkTo } = req.body;
    
    if (!title || !message || !type || !recipientId) {
      return res.status(400).json({ message: 'Title, message, type, and recipientId are required' });
    }

    if (!notificationTypes.includes(type)) {
      return res.status(400).json({ message: 'Invalid notification type' });
    }

    const notification = await storage.createNotification({
      title,
      message,
      type,
      userId: recipientId,
      linkTo: linkTo || undefined
    });

    res.status(201).json(notification);
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ message: 'Failed to create notification', error: (error as Error).message });
  }
}

// Send role-specific notifications (for admins)
export async function sendRoleNotifications(req: Request, res: Response) {
  try {
    const { role, title, message, type, linkTo } = req.body;
    
    if (!role || !title || !message || !type) {
      return res.status(400).json({ message: 'Role, title, message, and type are required' });
    }

    if (!notificationTypes.includes(type)) {
      return res.status(400).json({ message: 'Invalid notification type' });
    }

    // Get all users with the specified role
    const users = await storage.getUsersByRole(role);
    
    // Create notifications for each user
    const notificationPromises = users.map(user => 
      storage.createNotification({
        title,
        message,
        type,
        userId: user.id,
        linkTo: linkTo || undefined
      })
    );

    await Promise.all(notificationPromises);

    res.status(201).json({ 
      success: true, 
      message: `Sent notifications to ${users.length} ${role} users`
    });
  } catch (error) {
    console.error('Error sending role notifications:', error);
    res.status(500).json({ message: 'Failed to send role notifications', error: (error as Error).message });
  }
}

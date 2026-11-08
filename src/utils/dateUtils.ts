import { format, isToday, isYesterday, isThisWeek, isThisYear } from 'date-fns';

export const formatListDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  if (isToday(date)) {
    return format(date, 'h:mm a');
  }
  if (isYesterday(date)) {
    return 'Yesterday';
  }
  if (isThisWeek(date)) {
    return format(date, 'EEEE'); // e.g. Monday
  }
  if (isThisYear(date)) {
    return format(date, 'M/d/yy');
  }
  return format(date, 'M/d/yy');
};

export const formatEditorDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return format(date, "MMMM d, yyyy 'at' h:mm a");
};

export type DateBucket = 'Today' | 'Yesterday' | 'Previous 7 Days' | 'Older';

export const getDateBucket = (timestamp: number): DateBucket => {
  const date = new Date(timestamp);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  if (isThisWeek(date)) return 'Previous 7 Days';
  return 'Older';
};


/**
 * Sample interface for testing
 */
export interface User {
  id: string;
  name: string;
  email?: string;
  age: number;
}

/**
 * Extended user interface
 */
export interface AdminUser extends User {
  permissions: string[];
  role: 'admin' | 'superadmin';
}

/**
 * Simple type alias
 */
export type UserId = string;

/**
 * Object type alias
 */
export type UserProfile = {
  userId: string;
  displayName: string;
  avatar?: string;
};

/**
 * Union type
 */
export type Status = 'active' | 'inactive' | 'pending';

/**
 * Complex type with generics
 */
export type ApiResponse<T> = { success: true; data: T } | { success: false; error: string };

// Not exported - should be ignored
interface InternalConfig {
  apiKey: string;
}

export interface ConfigWithLongType {
  veryLongPropertyNameThatWillBeTruncatedBecauseItExceedsTheMaximumLengthAllowed:
    | 'some'
    | 'very'
    | 'long'
    | 'union'
    | 'type';
}

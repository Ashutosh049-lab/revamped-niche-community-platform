export interface ValidationResult {
  isValid: boolean;
  message?: string;
}

export const validateEmail = (email: string): ValidationResult => {
  if (!email.trim()) {
    return { isValid: false, message: "Email is required" };
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return { isValid: false, message: "Please enter a valid email address" };
  }
  
  return { isValid: true };
};

export const validatePassword = (password: string, isSignup = false): ValidationResult => {
  if (!password) {
    return { isValid: false, message: "Password is required" };
  }
  
  if (isSignup) {
    if (password.length < 6) {
      return { isValid: false, message: "Password must be at least 6 characters" };
    }
    
    if (password.length > 128) {
      return { isValid: false, message: "Password must be less than 128 characters" };
    }
    
    // Check for basic complexity
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    
    if (!hasLetter || !hasNumber) {
      return { isValid: false, message: "Password must contain at least one letter and one number" };
    }
  }
  
  return { isValid: true };
};

export const validateDisplayName = (name: string): ValidationResult => {
  const trimmed = name.trim();
  
  if (!trimmed) {
    return { isValid: false, message: "Display name is required" };
  }
  
  if (trimmed.length < 2) {
    return { isValid: false, message: "Display name must be at least 2 characters" };
  }
  
  if (trimmed.length > 50) {
    return { isValid: false, message: "Display name must be less than 50 characters" };
  }
  
  // Basic character validation
  const validChars = /^[a-zA-Z0-9\s._-]+$/;
  if (!validChars.test(trimmed)) {
    return { isValid: false, message: "Display name contains invalid characters" };
  }
  
  return { isValid: true };
};

export const getPasswordStrength = (password: string): {
  strength: 'weak' | 'fair' | 'good' | 'strong';
  score: number;
  feedback: string[];
} => {
  const feedback: string[] = [];
  let score = 0;
  
  if (password.length >= 6) score++;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;
  
  // Feedback
  if (password.length < 8) feedback.push("Use at least 8 characters");
  if (!/[a-z]/.test(password)) feedback.push("Add lowercase letters");
  if (!/[A-Z]/.test(password)) feedback.push("Add uppercase letters");
  if (!/\d/.test(password)) feedback.push("Add numbers");
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) feedback.push("Add special characters");
  
  let strength: 'weak' | 'fair' | 'good' | 'strong' = 'weak';
  if (score >= 6) strength = 'strong';
  else if (score >= 4) strength = 'good';
  else if (score >= 2) strength = 'fair';
  
  return { strength, score, feedback };
};

export const friendlyAuthError = (error: any): string => {
  const code = error?.code || '';
  
  // Common Firebase Auth errors
  if (code.includes('auth/invalid-email')) return 'Please enter a valid email address';
  if (code.includes('auth/user-not-found')) return 'No account found with this email address';
  if (code.includes('auth/wrong-password') || code.includes('auth/invalid-credential')) 
    return 'Incorrect email or password';
  if (code.includes('auth/email-already-in-use')) return 'An account with this email already exists';
  if (code.includes('auth/weak-password')) return 'Password should be at least 6 characters long';
  if (code.includes('auth/invalid-password')) return 'Invalid password format';
  if (code.includes('auth/too-many-requests')) 
    return 'Too many failed attempts. Please try again later';
  if (code.includes('auth/operation-not-allowed')) 
    return 'This sign-in method is not enabled';
  if (code.includes('auth/user-disabled')) return 'This account has been disabled';
  
  // Google Sign-in specific errors
  if (code.includes('auth/popup-closed-by-user')) 
    return 'Sign-in was cancelled. Please try again';
  if (code.includes('auth/popup-blocked')) 
    return 'Pop-up was blocked. Please allow pop-ups and try again';
  if (code.includes('auth/unauthorized-domain')) 
    return 'This domain is not authorized for sign-in';
  
  // Network and general errors
  if (code.includes('auth/network-request-failed')) 
    return 'Network error. Please check your connection';
  if (code.includes('auth/timeout')) 
    return 'Request timed out. Please try again';
  
  // Return original message or generic fallback
  return error?.message || 'An unexpected error occurred. Please try again';
};
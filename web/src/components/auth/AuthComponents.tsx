import React from 'react';
import { getPasswordStrength } from '../../utils/validation';

interface AuthFormWrapperProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  error?: string | null;
}

export function AuthFormWrapper({ children, title, subtitle, error }: AuthFormWrapperProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white border rounded-xl shadow-sm p-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
          <p className="text-gray-600">{subtitle}</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {children}
      </div>
    </div>
  );
}

interface FormFieldProps {
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  placeholder: string;
  error?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  showPasswordStrength?: boolean;
}

export function FormField({
  label,
  type,
  value,
  onChange,
  onKeyDown,
  placeholder,
  error,
  required = false,
  minLength,
  maxLength,
  showPasswordStrength = false
}: FormFieldProps) {
  const passwordStrength = showPasswordStrength && type === 'password' && value
    ? getPasswordStrength(value)
    : null;

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      <input
        type={type}
        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
          error
            ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
            : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
        }`}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        minLength={minLength}
        maxLength={maxLength}
        autoComplete={
          type === 'email' ? 'email' 
          : type === 'password' && label.toLowerCase().includes('current') ? 'current-password'
          : type === 'password' ? 'new-password'
          : 'off'
        }
      />

      {/* Password strength indicator */}
      {passwordStrength && (
        <div className="mt-2">
          <div className="flex items-center space-x-2">
            <div className="flex-1 bg-gray-200 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  passwordStrength.strength === 'weak' ? 'bg-red-500 w-1/4'
                  : passwordStrength.strength === 'fair' ? 'bg-yellow-500 w-2/4'
                  : passwordStrength.strength === 'good' ? 'bg-blue-500 w-3/4'
                  : 'bg-green-500 w-full'
                }`}
              />
            </div>
            <span className={`text-xs font-medium ${
              passwordStrength.strength === 'weak' ? 'text-red-600'
              : passwordStrength.strength === 'fair' ? 'text-yellow-600'
              : passwordStrength.strength === 'good' ? 'text-blue-600'
              : 'text-green-600'
            }`}>
              {passwordStrength.strength.charAt(0).toUpperCase() + passwordStrength.strength.slice(1)}
            </span>
          </div>
          {passwordStrength.feedback.length > 0 && (
            <p className="text-xs text-gray-600 mt-1">
              {passwordStrength.feedback[0]}
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}

interface SocialLoginButtonProps {
  provider: 'google';
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}

export function SocialLoginButton({
  provider,
  onClick,
  loading = false,
  disabled = false,
  children
}: SocialLoginButtonProps) {
  const icons = {
    google: (
      <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
    )
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || disabled}
      className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {loading ? (
        <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      ) : (
        icons[provider]
      )}
      <span className="ml-3 font-medium">{children}</span>
    </button>
  );
}

interface SubmitButtonProps {
  loading?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
}

export function SubmitButton({
  loading = false,
  disabled = false,
  children,
  onClick,
  variant = 'primary'
}: SubmitButtonProps) {
  const baseClasses = "w-full px-4 py-2 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
  const variantClasses = variant === 'primary'
    ? "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500"
    : "bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || disabled}
      className={`${baseClasses} ${variantClasses}`}
    >
      {loading ? (
        <div className="flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
          Processing...
        </div>
      ) : (
        children
      )}
    </button>
  );
}

interface AuthLinkProps {
  to: string;
  children: React.ReactNode;
}

export function AuthLink({ to, children }: AuthLinkProps) {
  return (
    <a
      href={to}
      className="text-blue-600 hover:text-blue-700 font-medium hover:underline transition-colors"
    >
      {children}
    </a>
  );
}

interface DividerProps {
  text?: string;
}

export function Divider({ text = 'or' }: DividerProps) {
  return (
    <div className="relative my-4">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-gray-300" />
      </div>
      <div className="relative flex justify-center text-sm">
        <span className="px-2 bg-white text-gray-500">{text}</span>
      </div>
    </div>
  );
}
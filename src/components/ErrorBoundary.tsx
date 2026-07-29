import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './ThemedText';
import { reportError } from '../services/errorReporting';
import { useThemedStyles } from '../hooks/useThemedStyles';
import type { ThemeColors } from '../theme/colors';

type Props = {
  children: React.ReactNode;
};

type State = {
  error: Error | null;
};

function FallbackScreen({ error }: { error: Error }) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.message}>{error.message}</Text>
    </View>
  );
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    reportError(error, {
      componentStack: (info.componentStack ?? '').slice(0, 2000),
    });
  }

  render() {
    const { error } = this.state;
    if (error) {
      return <FallbackScreen error={error} />;
    }
    return this.props.children;
  }
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      paddingHorizontal: 24,
    },
    title: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '600',
      textAlign: 'center',
      marginBottom: 8,
    },
    message: {
      color: colors.muted,
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
    },
  });
}

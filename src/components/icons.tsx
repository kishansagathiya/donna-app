import React from 'react';
import Svg, { Ellipse, Line, Path, Polyline, Rect } from 'react-native-svg';

type IconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

function IconFrame({
  size = 24,
  children,
}: {
  size?: number;
  children: React.ReactNode;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {children}
    </Svg>
  );
}

export function MicIcon({
  size = 24,
  color = 'currentColor',
  strokeWidth = 1.75,
}: IconProps) {
  return (
    <IconFrame size={size}>
      <Path
        d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M19 10v2a7 7 0 0 1-14 0v-2"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1="12"
        y1="19"
        x2="12"
        y2="22"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </IconFrame>
  );
}

export function StopIcon({
  size = 24,
  color = 'currentColor',
}: Pick<IconProps, 'size' | 'color'>) {
  return (
    <IconFrame size={size}>
      <Rect
        x="6"
        y="6"
        width="12"
        height="12"
        rx="2"
        fill={color}
      />
    </IconFrame>
  );
}

export function SettingsIcon({
  size = 24,
  color = 'currentColor',
  strokeWidth = 1.75,
}: IconProps) {
  return (
    <IconFrame size={size}>
      <Path
        d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 15a3 3 0 0 0 0-6 3 3 0 0 0 0 6Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconFrame>
  );
}

export function MessageSquareIcon({
  size = 24,
  color = 'currentColor',
  strokeWidth = 1.75,
}: IconProps) {
  return (
    <IconFrame size={size}>
      <Path
        d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconFrame>
  );
}

export function DatabaseIcon({
  size = 24,
  color = 'currentColor',
  strokeWidth = 1.75,
}: IconProps) {
  return (
    <IconFrame size={size}>
      <Ellipse
        cx="12"
        cy="5"
        rx="9"
        ry="3"
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Path
        d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconFrame>
  );
}

export function UserIcon({
  size = 24,
  color = 'currentColor',
  strokeWidth = 1.75,
}: IconProps) {
  return (
    <IconFrame size={size}>
      <Path
        d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 11a4 4 0 0 0 0-8 4 4 0 0 0 0 8Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconFrame>
  );
}

export function ArrowUpIcon({
  size = 24,
  color = 'currentColor',
  strokeWidth = 2,
}: IconProps) {
  return (
    <IconFrame size={size}>
      <Line
        x1="12"
        y1="19"
        x2="12"
        y2="5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Polyline
        points="5 12 12 5 19 12"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconFrame>
  );
}

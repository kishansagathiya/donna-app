import React from 'react';
import Svg, {
  Circle,
  Ellipse,
  Line,
  Path,
  Polyline,
  Rect,
} from 'react-native-svg';

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

export function PaperclipIcon({
  size = 24,
  color = 'currentColor',
  strokeWidth = 1.75,
}: IconProps) {
  return (
    <IconFrame size={size}>
      <Path
        d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconFrame>
  );
}

export function HistoryIcon({
  size = 24,
  color = 'currentColor',
  strokeWidth = 1.75,
}: IconProps) {
  return (
    <IconFrame size={size}>
      <Path
        d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M3 3v5h5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 7v5l4 2"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconFrame>
  );
}

export function StickyNoteIcon({
  size = 24,
  color = 'currentColor',
  strokeWidth = 1.75,
}: IconProps) {
  return (
    <IconFrame size={size}>
      <Path
        d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M15 3v4a2 2 0 0 0 2 2h4"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconFrame>
  );
}

export function CalendarCheckIcon({
  size = 24,
  color = 'currentColor',
  strokeWidth = 1.75,
}: IconProps) {
  return (
    <IconFrame size={size}>
      <Rect
        x="3"
        y="4"
        width="18"
        height="18"
        rx="2"
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Line
        x1="16"
        y1="2"
        x2="16"
        y2="6"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1="8"
        y1="2"
        x2="8"
        y2="6"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1="3"
        y1="10"
        x2="21"
        y2="10"
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Path
        d="m9 16 2 2 4-4"
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

export function ArrowDownIcon({
  size = 24,
  color = 'currentColor',
  strokeWidth = 2,
}: IconProps) {
  return (
    <IconFrame size={size}>
      <Line
        x1="12"
        y1="5"
        x2="12"
        y2="19"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Polyline
        points="19 12 12 19 5 12"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconFrame>
  );
}

export function PlusIcon({
  size = 24,
  color = 'currentColor',
  strokeWidth = 2,
}: IconProps) {
  return (
    <IconFrame size={size}>
      <Line
        x1="12"
        y1="5"
        x2="12"
        y2="19"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1="5"
        y1="12"
        x2="19"
        y2="12"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </IconFrame>
  );
}

export function SearchIcon({
  size = 24,
  color = 'currentColor',
  strokeWidth = 1.75,
}: IconProps) {
  return (
    <IconFrame size={size}>
      <Circle
        cx="11"
        cy="11"
        r="7"
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Line
        x1="16.5"
        y1="16.5"
        x2="21"
        y2="21"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </IconFrame>
  );
}

export function CopyIcon({
  size = 24,
  color = 'currentColor',
  strokeWidth = 1.75,
}: IconProps) {
  return (
    <IconFrame size={size}>
      <Rect
        x="9"
        y="9"
        width="13"
        height="13"
        rx="2"
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Path
        d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconFrame>
  );
}

export function CheckIcon({
  size = 24,
  color = 'currentColor',
  strokeWidth = 2,
}: IconProps) {
  return (
    <IconFrame size={size}>
      <Path
        d="m5 12 4 4L19 7"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconFrame>
  );
}

export function InboxIcon({
  size = 24,
  color = 'currentColor',
  strokeWidth = 1.75,
}: IconProps) {
  return (
    <IconFrame size={size}>
      <Path
        d="M22 12h-6l-2 3h-4l-2-3H2"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconFrame>
  );
}

export function PencilIcon({
  size = 24,
  color = 'currentColor',
  strokeWidth = 1.75,
}: IconProps) {
  return (
    <IconFrame size={size}>
      <Path
        d="M12 20h9"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconFrame>
  );
}

export function RefreshIcon({
  size = 24,
  color = 'currentColor',
  strokeWidth = 1.75,
}: IconProps) {
  return (
    <IconFrame size={size}>
      <Path
        d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M21 3v5h-5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M8 16H3v5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconFrame>
  );
}

export function ThumbsUpIcon({
  size = 24,
  color = 'currentColor',
  strokeWidth = 1.75,
}: IconProps) {
  return (
    <IconFrame size={size}>
      <Path
        d="M7 10v12"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconFrame>
  );
}

export function ThumbsDownIcon({
  size = 24,
  color = 'currentColor',
  strokeWidth = 1.75,
}: IconProps) {
  return (
    <IconFrame size={size}>
      <Path
        d="M17 14V2"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconFrame>
  );
}

export function PinIcon({
  size = 24,
  color = 'currentColor',
  strokeWidth = 1.75,
}: IconProps) {
  return (
    <IconFrame size={size}>
      <Path
        d="M12 17v5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconFrame>
  );
}

export function ArchiveIcon({
  size = 24,
  color = 'currentColor',
  strokeWidth = 1.75,
}: IconProps) {
  return (
    <IconFrame size={size}>
      <Rect
        x="2"
        y="3"
        width="20"
        height="5"
        rx="1"
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Path
        d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M10 12h4"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconFrame>
  );
}

export function TrashIcon({
  size = 24,
  color = 'currentColor',
  strokeWidth = 1.75,
}: IconProps) {
  return (
    <IconFrame size={size}>
      <Path
        d="M3 6h18"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconFrame>
  );
}

export function TagIcon({
  size = 24,
  color = 'currentColor',
  strokeWidth = 1.75,
}: IconProps) {
  return (
    <IconFrame size={size}>
      <Path
        d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M7 7h.01"
        stroke={color}
        strokeWidth={strokeWidth * 1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconFrame>
  );
}

export function MoreHorizontalIcon({
  size = 24,
  color = 'currentColor',
  strokeWidth = 1.75,
}: IconProps) {
  return (
    <IconFrame size={size}>
      <Circle cx="12" cy="12" r="1" fill={color} strokeWidth={strokeWidth} />
      <Circle cx="19" cy="12" r="1" fill={color} strokeWidth={strokeWidth} />
      <Circle cx="5" cy="12" r="1" fill={color} strokeWidth={strokeWidth} />
    </IconFrame>
  );
}

export function GlobeIcon({
  size = 24,
  color = 'currentColor',
  strokeWidth = 1.75,
}: IconProps) {
  return (
    <IconFrame size={size}>
      <Circle
        cx="12"
        cy="12"
        r="10"
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Path
        d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1="2"
        y1="12"
        x2="22"
        y2="12"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </IconFrame>
  );
}

export function BrainIcon({
  size = 24,
  color = 'currentColor',
  strokeWidth = 1.75,
}: IconProps) {
  return (
    <IconFrame size={size}>
      <Path
        d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M17.599 6.5a3 3 0 0 0 .399-1.375"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M6.003 5.125A3 3 0 0 0 6.401 6.5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M3.023 10.125A4 4 0 0 0 5.5 9.5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M18.5 9.5a4 4 0 0 0 2.477.625"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M6 18a4 4 0 0 0 4-4"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M14 18a4 4 0 0 1-4-4"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconFrame>
  );
}

export function BookOpenIcon({
  size = 24,
  color = 'currentColor',
  strokeWidth = 1.75,
}: IconProps) {
  return (
    <IconFrame size={size}>
      <Path
        d="M12 7v14"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
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
      <Circle
        cx="12"
        cy="12"
        r="3"
        stroke={color}
        strokeWidth={strokeWidth}
      />
    </IconFrame>
  );
}

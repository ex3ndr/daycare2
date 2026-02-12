import { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

type ChatDropZoneProps = {
  isDragOver: boolean;
  onDragEnter: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  children: ReactNode;
};

export function ChatDropZone({
  isDragOver,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  children,
}: ChatDropZoneProps) {
  return (
    <View style={styles.container}>
      {/* Thin HTML wrapper for web-only drag events */}
      <div
        style={{ display: "flex", flex: 1, flexDirection: "column", minWidth: 0, position: "relative" }}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        {isDragOver && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-primary/10 pointer-events-none">
            <div className="rounded-lg border-2 border-dashed border-primary bg-background/80 px-8 py-6">
              <p className="text-sm font-medium text-primary">
                Drop files to upload
              </p>
            </div>
          </div>
        )}
        {children}
      </div>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "column",
    minWidth: 0,
  },
});

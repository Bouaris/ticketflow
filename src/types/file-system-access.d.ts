/**
 * File System Access API Type Declarations
 *
 * Extends the built-in FileSystemFileHandle with permission methods
 * that are part of the W3C spec but not yet in TypeScript's lib.dom.d.ts
 *
 * @see https://wicg.github.io/file-system-access/
 */

interface FileSystemPermissionDescriptor {
  mode?: 'read' | 'readwrite';
}

interface FileSystemFileHandle {
  /**
   * Query the current permission state for the handle
   */
  queryPermission(descriptor?: FileSystemPermissionDescriptor): Promise<PermissionState>;

  /**
   * Request permission to read or write to the file
   */
  requestPermission(descriptor?: FileSystemPermissionDescriptor): Promise<PermissionState>;
}

interface FileSystemDirectoryHandle {
  /**
   * Query the current permission state for the handle
   */
  queryPermission(descriptor?: FileSystemPermissionDescriptor): Promise<PermissionState>;

  /**
   * Request permission to read or write to the directory
   */
  requestPermission(descriptor?: FileSystemPermissionDescriptor): Promise<PermissionState>;
}

interface DirectoryPickerOptions {
  id?: string;
  mode?: 'read' | 'readwrite';
  startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos' | FileSystemHandle;
}

interface Window {
  /**
   * Opens a directory picker dialog
   */
  showDirectoryPicker(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>;
}

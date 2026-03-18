declare module '@/components/ui/*' {
  const moduleExports: any;
  export = moduleExports;
}

declare module 'file-saver' {
  export const saveAs: (...args: any[]) => void;
}

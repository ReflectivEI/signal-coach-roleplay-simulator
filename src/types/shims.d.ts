declare module '@/components/ui/button' {
  export const Button: any;
  export const buttonVariants: any;
}

declare module '@/components/ui/input' {
  export const Input: any;
}

declare module '@/components/ui/select' {
  export const Select: any;
  export const SelectGroup: any;
  export const SelectValue: any;
  export const SelectTrigger: any;
  export const SelectContent: any;
  export const SelectLabel: any;
  export const SelectItem: any;
  export const SelectSeparator: any;
  export const SelectScrollUpButton: any;
  export const SelectScrollDownButton: any;
}

declare module '@/components/ui/tabs' {
  export const Tabs: any;
  export const TabsList: any;
  export const TabsTrigger: any;
  export const TabsContent: any;
}

declare module '@/components/ui/card' {
  export const Card: any;
  export const CardHeader: any;
  export const CardFooter: any;
  export const CardTitle: any;
  export const CardDescription: any;
  export const CardContent: any;
}

declare module '@/components/ui/badge' {
  export const Badge: any;
  export const badgeVariants: any;
}

declare module 'file-saver' {
  export const saveAs: (...args: any[]) => void;
}

declare module '__STATIC_CONTENT_MANIFEST' {
  const manifestJSON: string;
  export default manifestJSON;
}

interface ImportMeta {
  env: Record<string, string | boolean | undefined>;
}

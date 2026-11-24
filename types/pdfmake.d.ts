declare module "pdfmake/build/pdfmake" {
  interface PdfMakeClient {
    addVirtualFileSystem?: (vfs: Record<string, string>) => void
    createPdf: (doc: Record<string, unknown>) => {
      download: (name: string) => Promise<void>
    }
  }

  const pdfMake: PdfMakeClient
  export default pdfMake
}

declare module "pdfmake/build/vfs_fonts" {
  const vfs: Record<string, string>
  export default vfs
}

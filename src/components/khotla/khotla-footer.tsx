export function KhotlaFooter() {
  return (
    <footer className="mt-auto bg-header-bg border-t border-header-border px-4 py-3">
      <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-gray-300">
        <div className="flex items-center gap-2">
          <span className="text-gold font-semibold">KHOTLA AI</span>
          <span>•</span>
          <span>Sovereign Governance Platform</span>
          <span>•</span>
          <span>Kingdom of Lesotho</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Evolution API • Groq AI • Prisma</span>
          <span>•</span>
          <span className="text-gold/60">Sechaba se Bua</span>
        </div>
      </div>
    </footer>
  )
}

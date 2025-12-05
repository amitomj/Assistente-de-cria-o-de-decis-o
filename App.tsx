import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Loader2, Scale, Download, Eye, Edit2, FileText, ChevronLeft, Info, RefreshCw, X, Key, LogOut, ExternalLink } from 'lucide-react';
import { FileUpload } from './components/FileUpload';
import { extractCaseData } from './services/geminiService';
import { generateDocx } from './services/docGenerator';
import { AppealPair, CaseData, AppStatus } from './types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>('');
  const [showKeyInput, setShowKeyInput] = useState<boolean>(true);
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [sentenceFile, setSentenceFile] = useState<File | null>(null);
  const [appealPairs, setAppealPairs] = useState<AppealPair[]>([
    { id: '1', appeal: null, response: null }
  ]);
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    const storedKey = localStorage.getItem('gemini_api_key');
    if (storedKey) {
      setApiKey(storedKey);
      setShowKeyInput(false);
    }
  }, []);

  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey.trim()) {
      localStorage.setItem('gemini_api_key', apiKey.trim());
      setShowKeyInput(false);
    }
  };

  const handleClearKey = () => {
    localStorage.removeItem('gemini_api_key');
    setApiKey('');
    setShowKeyInput(true);
    setStatus(AppStatus.IDLE);
    setCaseData(null);
  };

  const addAppealPair = () => {
    setAppealPairs([
      ...appealPairs,
      { id: Date.now().toString(), appeal: null, response: null }
    ]);
  };

  const removeAppealPair = (id: string) => {
    if (appealPairs.length > 1) {
      setAppealPairs(appealPairs.filter(p => p.id !== id));
    }
  };

  const updateAppealPair = (id: string, type: 'appeal' | 'response', file: File | null) => {
    setAppealPairs(appealPairs.map(p => 
      p.id === id ? { ...p, [type]: file } : p
    ));
  };

  const handleProcess = async () => {
    if (!sentenceFile) {
      setErrorMsg("A Sentença de 1ª Instância é obrigatória.");
      return;
    }
    const hasAtLeastOneAppeal = appealPairs.some(p => p.appeal !== null);
    if (!hasAtLeastOneAppeal) {
      setErrorMsg("É necessário carregar pelo menos um Recurso.");
      return;
    }

    setStatus(AppStatus.PROCESSING);
    setErrorMsg(null);

    try {
      // Pass the API Key to the service
      const data = await extractCaseData(apiKey, sentenceFile, appealPairs);
      setCaseData(data);
      setStatus(AppStatus.REVIEW);
    } catch (err: any) {
      console.error(err);
      let msg = "Ocorreu um erro ao processar. Verifique os ficheiros.";
      if (err.message && (err.message.includes("API Key") || err.message.includes("403") || err.message.includes("401"))) {
        msg = "Chave de API inválida ou expirada. Por favor verifique a sua chave.";
      }
      setErrorMsg(msg);
      setStatus(AppStatus.ERROR);
    }
  };

  const handleDownload = () => {
    if (caseData) {
      generateDocx(caseData);
    }
  };

  const handleReset = () => {
    setStatus(AppStatus.IDLE);
    setCaseData(null);
    setSentenceFile(null);
    setAppealPairs([{ id: '1', appeal: null, response: null }]);
    setErrorMsg(null);
  };

  const renderApiKeyScreen = () => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-fade-in">
       <div className="bg-card-bg border border-slate-700 p-8 rounded-xl shadow-2xl max-w-md w-full">
          <div className="flex flex-col items-center mb-6">
             <div className="bg-primary/20 p-3 rounded-full mb-4">
                <Key className="w-8 h-8 text-primary" />
             </div>
             <h2 className="text-xl font-bold text-white text-center">Configuração da API</h2>
             <p className="text-slate-400 text-center text-sm mt-2">
               Para utilizar a Inteligência Artificial, é necessário uma chave da Google Gemini API.
             </p>
          </div>

          <form onSubmit={handleSaveKey} className="space-y-4">
            <div>
              <label className="block text-xs uppercase font-bold text-slate-500 mb-1">Chave API (Google Gemini)</label>
              <input 
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Ex: AIzaSy..."
                className="w-full bg-input-bg border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder-slate-500"
                required
              />
            </div>
            
            <button 
              type="submit"
              className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3 rounded transition-colors shadow-lg shadow-primary/20"
            >
              Entrar
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-700">
             <a 
               href="https://aistudio.google.com/app/apikey" 
               target="_blank" 
               rel="noopener noreferrer"
               className="flex items-center justify-center gap-2 text-primary hover:text-white transition-colors text-sm font-medium group"
             >
               <ExternalLink className="w-4 h-4" />
               Obter chave gratuita no Google AI Studio
             </a>
             <p className="text-center text-xs text-slate-500 mt-2">
               A chave é guardada apenas no seu navegador.
             </p>
          </div>
       </div>
    </div>
  );

  const renderContent = () => {
    if (showKeyInput) return renderApiKeyScreen();

    // LOADING STATE
    if (status === AppStatus.PROCESSING) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping"></div>
            <div className="relative bg-card-bg p-4 rounded-full shadow-lg border border-slate-700">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </div>
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-xl font-bold text-white">A analisar documentos com IA</h3>
            <p className="text-slate-400 max-w-xs mx-auto">
              O modelo Gemini está a ler a sentença e os recursos, a identificar os factos provados e a estruturar o projeto de acórdão.
            </p>
          </div>
        </div>
      );
    }

    // REVIEW STATE
    if (status === AppStatus.REVIEW && caseData) {
      return (
        <div className="space-y-6 animate-fade-in pb-8">
           {/* Success Banner */}
          <section className="bg-primary/20 border border-primary/30 rounded-lg p-4 flex items-start gap-4">
             <div className="bg-primary p-2 rounded-full text-white shrink-0 shadow-lg shadow-primary/20">
                <Info className="w-5 h-5" />
             </div>
             <div>
                <p className="text-white font-bold text-base">Análise Concluída</p>
                <p className="text-slate-300 text-sm mt-1">
                  A IA extraiu os dados abaixo. Verifique e edite conforme necessário antes de exportar o documento final.
                </p>
             </div>
          </section>

          {/* I - Relatorio */}
          <section>
             <h3 className="text-white text-lg font-bold px-1 pb-3 pt-2">I. Relatório</h3>
             <div className="bg-card-bg border border-slate-700 rounded-lg p-4 space-y-4">
                <div className="space-y-2">
                    <label className="text-xs text-slate-400 uppercase font-bold">Texto do Relatório</label>
                    <textarea
                      className="w-full h-40 bg-input-bg border-none rounded text-slate-200 text-sm focus:ring-1 focus:ring-primary resize-y placeholder-slate-500"
                      placeholder="Conteúdo do relatório..."
                      value={caseData.report}
                      onChange={(e) => setCaseData({...caseData, report: e.target.value})}
                    />
                </div>
                
                <div className="space-y-2 pt-2 border-t border-slate-600">
                    <label className="text-xs text-slate-400 uppercase font-bold">Decisão da 1ª Instância (Parte final do Relatório)</label>
                    <p className="text-xs text-slate-500 italic mb-1">Será antecedida pela frase: "Foi proferida sentença que"</p>
                    <textarea
                      className="w-full h-24 bg-input-bg border-none rounded text-slate-200 text-sm focus:ring-1 focus:ring-primary resize-y placeholder-slate-500"
                      placeholder="Decisão da 1ª Instância..."
                      value={caseData.decisionFirstInstance}
                      onChange={(e) => setCaseData({...caseData, decisionFirstInstance: e.target.value})}
                    />
                </div>
             </div>
          </section>

          {/* II - Factos */}
          <section>
             <div className="flex justify-between items-end px-1 pb-3 pt-2">
                <h3 className="text-white text-lg font-bold">II. Factos Provados</h3>
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="text-primary hover:text-primary-hover text-sm font-bold flex items-center gap-1 transition-colors"
                >
                  {showPreview ? <><Edit2 className="w-3 h-3" /> Editar</> : <><Eye className="w-3 h-3" /> Visualizar</>}
                </button>
             </div>
             
             <div className="bg-card-bg border border-slate-700 rounded-lg p-4 min-h-[12rem]">
               {showPreview ? (
                  <div className="prose prose-sm prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {caseData.provenFacts}
                    </ReactMarkdown>
                  </div>
               ) : (
                  <textarea
                    className="w-full h-96 bg-input-bg border-none rounded text-slate-200 text-sm focus:ring-1 focus:ring-primary resize-y font-mono"
                    value={caseData.provenFacts}
                    onChange={(e) => setCaseData({...caseData, provenFacts: e.target.value})}
                  />
               )}
             </div>
          </section>

          {/* III - Conclusoes */}
          <section>
             <h3 className="text-white text-lg font-bold px-1 pb-3 pt-2">III. Conclusões dos Recursos</h3>
             <div className="space-y-4">
               {caseData.appealConclusions.map((ac, idx) => (
                 <div key={idx} className="bg-card-bg border border-slate-700 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-start border-b border-slate-600 pb-2">
                       <span className="font-bold text-white text-sm">{ac.source}</span>
                       <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${
                         ac.type === 'RECURSO' ? 'bg-primary/20 text-primary' : 'bg-orange-900/40 text-orange-400'
                       }`}>
                         {ac.type}
                       </span>
                    </div>
                    <textarea
                      className="w-full h-48 bg-input-bg border-none rounded text-slate-200 text-sm focus:ring-1 focus:ring-primary resize-y"
                      value={ac.content}
                      onChange={(e) => {
                        const newConclusions = [...caseData.appealConclusions];
                        newConclusions[idx] = { ...ac, content: e.target.value };
                        setCaseData({ ...caseData, appealConclusions: newConclusions });
                      }}
                    />
                 </div>
               ))}
             </div>
          </section>
        </div>
      );
    }

    // UPLOAD STATE (Default)
    return (
      <div className="space-y-6 animate-fade-in pb-8">
        
        {/* Step 1: Sentence */}
        <section>
           <h3 className="text-white text-lg font-bold px-1 pb-3 pt-2">1. Sentença Recorrida</h3>
           <div className="bg-card-bg border border-slate-700 rounded-lg p-6 shadow-sm">
              <FileUpload
                label="Carregar Sentença (1ª Instância)"
                file={sentenceFile}
                onFileSelect={setSentenceFile}
                onRemove={() => setSentenceFile(null)}
              />
           </div>
        </section>

        {/* Step 2: Appeals */}
        <section>
           <div className="flex justify-between items-center px-1 pb-3 pt-2">
             <h3 className="text-white text-lg font-bold">2. Recursos e Respostas</h3>
           </div>
           
           <div className="space-y-4">
             {appealPairs.map((pair, index) => (
               <div key={pair.id} className="bg-card-bg border border-slate-700 rounded-lg p-6 space-y-4 relative group shadow-sm transition-all hover:border-slate-600">
                  <div className="flex justify-between items-center border-b border-slate-700 pb-2 mb-2">
                     <p className="text-sm font-bold text-slate-200">Recurso #{index + 1}</p>
                     {appealPairs.length > 1 && (
                        <button 
                          onClick={() => removeAppealPair(pair.id)}
                          className="text-slate-500 hover:text-red-400 transition-colors p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                     )}
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-400 ml-1">Alegações</label>
                      <FileUpload
                        label="Alegações de Recurso"
                        file={pair.appeal}
                        onFileSelect={(f) => updateAppealPair(pair.id, 'appeal', f)}
                        onRemove={() => updateAppealPair(pair.id, 'appeal', null)}
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-400 ml-1">Contra-alegações</label>
                      <FileUpload
                        label="Resposta (Opcional)"
                        file={pair.response}
                        onFileSelect={(f) => updateAppealPair(pair.id, 'response', f)}
                        onRemove={() => updateAppealPair(pair.id, 'response', null)}
                      />
                    </div>
                  </div>
               </div>
             ))}

             <button 
                onClick={addAppealPair}
                className="w-full py-3 rounded-lg border border-dashed border-slate-600 text-slate-400 font-medium text-sm hover:bg-slate-800 hover:text-white hover:border-primary transition-all flex items-center justify-center gap-2"
             >
                <Plus className="w-4 h-4" />
                Adicionar Outro Recurso
             </button>
           </div>
        </section>

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-lg flex items-start gap-3" role="alert">
            <Info className="w-5 h-5 shrink-0" />
            <div>
               <p className="font-bold text-sm">Erro no processamento</p>
               <p className="text-sm opacity-90">{errorMsg}</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  const getFooterActions = () => {
    if (showKeyInput) return null;
    if (status === AppStatus.PROCESSING) return null;

    if (status === AppStatus.REVIEW) {
      return (
        <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={handleReset}
              className="flex h-12 w-full items-center justify-center rounded bg-slate-700 text-white text-base font-medium transition-colors hover:bg-slate-600 gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Novo
            </button>
            <button 
              onClick={handleDownload}
              className="flex h-12 w-full items-center justify-center rounded bg-primary text-white text-base font-bold transition-colors hover:bg-primary-hover gap-2 shadow-lg shadow-primary/20"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={handleReset}
             className="flex h-12 w-full items-center justify-center rounded bg-slate-700 text-white text-base font-medium transition-colors hover:bg-slate-600"
          >
             Limpar
          </button>
         <button 
            onClick={handleProcess}
            disabled={!sentenceFile}
            className={`
              flex h-12 w-full items-center justify-center rounded text-base font-bold transition-all gap-2
              ${!sentenceFile 
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700' 
                : 'bg-primary text-white hover:bg-primary-hover shadow-lg shadow-primary/20'
              }
            `}
         >
            <FileText className="w-5 h-5" />
            Selecionar Texto
         </button>
      </div>
    );
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col font-sans bg-app-bg text-white selection:bg-primary selection:text-white">
      
      {/* Centered Header like image */}
      <header className="flex flex-col items-center justify-center pt-8 pb-6 px-4 space-y-1 relative">
         <div className="absolute top-4 right-4">
           {!showKeyInput && (
             <button 
               onClick={handleClearKey}
               title="Alterar Chave API"
               className="text-slate-500 hover:text-white transition-colors"
             >
               <LogOut className="w-5 h-5" />
             </button>
           )}
         </div>
         <h1 className="text-2xl md:text-3xl font-bold text-center leading-tight">
           Assistente de Elaboração de Acórdão
         </h1>
         <p className="text-slate-400 font-medium text-center text-sm md:text-base">
           Tribunal da Relação - Assistência Inteligente
         </p>
      </header>

      {/* Main Content */}
      <main className="flex-grow p-4 w-full max-w-3xl mx-auto">
        {!showKeyInput && status === AppStatus.REVIEW && (
          <div className="mb-4">
            <button 
              onClick={() => setStatus(AppStatus.IDLE)} 
              className="flex items-center text-slate-400 hover:text-white transition-colors text-sm font-medium"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Voltar ao início
            </button>
          </div>
        )}
        
        {renderContent()}
      </main>

      {/* Footer Area */}
      {status !== AppStatus.PROCESSING && !showKeyInput && (
        <div className="p-6 max-w-3xl mx-auto w-full mb-8">
           {getFooterActions()}
        </div>
      )}
    </div>
  );
};

export default App;
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Loader2, Scale, Download, Eye, Edit2, FileText, ChevronLeft, Info, RefreshCw, X, Key, LogOut, ExternalLink, Settings, Save, Upload } from 'lucide-react';
import { FileUpload } from './components/FileUpload';
import { extractCaseData } from './services/geminiService';
import { generateDocx } from './services/docGenerator';
import { AppealPair, CaseData, AppStatus, TemplateSettings } from './types';
import { COMMON_FONTS, DEFAULT_TEMPLATE } from './constants';
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
  const [previews, setPreviews] = useState<any>({
    report: false,
    provenFacts: true,
    unprovenFacts: true,
    decisionFirstInstance: false,
    appealQuestions: false,
    impugnedFacts: false,
    conclusions: {}
  });
  const [showSettings, setShowSettings] = useState(false);
  const [templateSettings, setTemplateSettings] = useState<TemplateSettings>(DEFAULT_TEMPLATE);

  useEffect(() => {
    const storedKey = localStorage.getItem('gemini_api_key');
    if (storedKey) {
      setApiKey(storedKey);
      setShowKeyInput(false);
    }

    const storedTemplate = localStorage.getItem('template_settings');
    if (storedTemplate) {
      try {
        const parsed = JSON.parse(storedTemplate);
        // Deep merge top-level style objects to ensure all nested properties (like indentLeft) exist
        const merged = { ...DEFAULT_TEMPLATE };
        
        Object.keys(DEFAULT_TEMPLATE).forEach(key => {
          const k = key as keyof TemplateSettings;
          if (typeof DEFAULT_TEMPLATE[k] === 'object' && DEFAULT_TEMPLATE[k] !== null && parsed[k]) {
            merged[k] = { 
              ...DEFAULT_TEMPLATE[k], 
              ...parsed[k] 
            };
          } else if (parsed[k] !== undefined) {
            (merged as any)[k] = parsed[k];
          }
        });
        
        setTemplateSettings(merged);
      } catch (e) {
        console.error("Erro ao carregar modelo salvo:", e);
        setTemplateSettings(DEFAULT_TEMPLATE);
      }
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
      console.error("Erro no processamento:", err);
      let msg = "Ocorreu um erro ao processar os documentos. ";
      
      if (err.message) {
        if (err.message.includes("API Key") || err.message.includes("403") || err.message.includes("401")) {
          msg = "Chave de API inválida ou sem permissões. Por favor, verifique a sua chave no Google AI Studio.";
        } else if (err.message.includes("model not found") || err.message.includes("503")) {
          msg = "O serviço da Google está temporariamente indisponível ou o modelo não foi encontrado. Tente novamente em instantes.";
        } else if (err.message.includes("quota") || err.message.includes("429")) {
          msg = "Limite de requisições excedido. Por favor, aguarde um momento antes de tentar novamente.";
        } else {
          msg += `Detalhes: ${err.message}`;
        }
      }
      
      setErrorMsg(msg);
      setStatus(AppStatus.ERROR);
    }
  };

  const handleDownload = () => {
    if (caseData) {
      generateDocx(caseData, templateSettings);
    }
  };

  const saveTemplateSettings = () => {
    localStorage.setItem('template_settings', JSON.stringify(templateSettings));
    setShowSettings(false);
  };

  const resetTemplate = () => {
    if (window.confirm("Tem a certeza que deseja repor os estilos padrão?")) {
      setTemplateSettings(DEFAULT_TEMPLATE);
      localStorage.removeItem('template_settings');
    }
  };

  const handleReset = () => {
    setStatus(AppStatus.IDLE);
    setCaseData(null);
    setSentenceFile(null);
    setAppealPairs([{ id: '1', appeal: null, response: null }]);
    setErrorMsg(null);
  };

  const handleExportJson = () => {
    if (!caseData) return;
    const dataStr = JSON.stringify(caseData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'projeto_acordao.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        // Basic validation
        if (json.report && json.provenFacts) {
          setCaseData(json);
          setStatus(AppStatus.REVIEW);
          setErrorMsg(null);
        } else {
          setErrorMsg("O ficheiro JSON selecionado não parece ser um projeto válido.");
        }
      } catch (err) {
        setErrorMsg("Erro ao ler o ficheiro JSON.");
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  const renderSettingsModal = () => {
    if (!showSettings) return null;

    const styleKeys = [
      { key: 'normal', label: 'Texto Normal' },
      { key: 'heading1', label: 'Cabeçalho 1' },
      { key: 'heading2', label: 'Cabeçalho 2' },
      { key: 'heading3', label: 'Cabeçalho 3' },
      { key: 'heading4', label: 'Cabeçalho 4' },
      { key: 'heading5', label: 'Cabeçalho 5' },
      { key: 'citation', label: 'Citações' },
    ];

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
        <div className="bg-card-bg border border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              Configurar Estilos do Documento
            </h2>
            <div className="flex items-center gap-4">
              <button 
                onClick={resetTemplate}
                className="text-xs text-red-400 hover:text-red-300 font-bold uppercase tracking-wider flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Repor Padrão
              </button>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="p-6 overflow-y-auto flex-grow space-y-6 bg-app-bg">
            <div className="grid grid-cols-1 gap-6">
              {styleKeys.map(({ key, label }) => {
                const style = templateSettings[key as keyof TemplateSettings] as any;
                
                return (
                  <div key={key} className="bg-card-bg border border-slate-700 rounded-xl overflow-hidden shadow-sm">
                    <div className="px-4 py-2 bg-slate-800/50 border-b border-slate-700 flex justify-between items-center">
                      <span className="font-bold text-primary text-sm uppercase tracking-wide">{label}</span>
                    </div>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
                      {/* Font & Size */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 uppercase font-bold">Fonte</label>
                        <select 
                          value={style.font} 
                          onChange={(e) => {
                            const newSettings = {...templateSettings};
                            (newSettings[key as keyof TemplateSettings] as any).font = e.target.value;
                            setTemplateSettings(newSettings as TemplateSettings);
                          }}
                          className="w-full bg-input-bg border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:ring-1 focus:ring-primary"
                        >
                          {COMMON_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 uppercase font-bold">Tamanho (pt)</label>
                        <input 
                          type="number" 
                          value={style.size ?? 12} 
                          onChange={(e) => {
                            const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                            const newSettings = {...templateSettings};
                            (newSettings[key as keyof TemplateSettings] as any).size = isNaN(val) ? 0 : val;
                            setTemplateSettings(newSettings as TemplateSettings);
                          }}
                          className="w-full bg-input-bg border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 uppercase font-bold">Alinhamento</label>
                        <select 
                          value={style.alignment ?? 'JUSTIFIED'} 
                          onChange={(e) => {
                            const newSettings = {...templateSettings};
                            (newSettings[key as keyof TemplateSettings] as any).alignment = e.target.value;
                            setTemplateSettings(newSettings as TemplateSettings);
                          }}
                          className="w-full bg-input-bg border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:ring-1 focus:ring-primary"
                        >
                          <option value="JUSTIFIED">Justificado</option>
                          <option value="LEFT">Esquerda</option>
                          <option value="CENTER">Centro</option>
                          <option value="RIGHT">Direita</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 uppercase font-bold">Espaçamento Linhas</label>
                        <select 
                          value={style.lineSpacing ?? 360} 
                          onChange={(e) => {
                            const newSettings = {...templateSettings};
                            (newSettings[key as keyof TemplateSettings] as any).lineSpacing = Number(e.target.value);
                            setTemplateSettings(newSettings as TemplateSettings);
                          }}
                          className="w-full bg-input-bg border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:ring-1 focus:ring-primary"
                        >
                          <option value={240}>Simples</option>
                          <option value={360}>1.5 Linhas</option>
                          <option value={480}>Duplo</option>
                        </select>
                      </div>

                      {/* Indentation */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 uppercase font-bold">Avanço Esq. (mm)</label>
                        <input 
                          type="number" 
                          value={style.indentLeft ?? 0} 
                          onChange={(e) => {
                            const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                            const newSettings = {...templateSettings};
                            (newSettings[key as keyof TemplateSettings] as any).indentLeft = isNaN(val) ? 0 : val;
                            setTemplateSettings(newSettings as TemplateSettings);
                          }}
                          className="w-full bg-input-bg border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 uppercase font-bold">Avanço Dir. (mm)</label>
                        <input 
                          type="number" 
                          value={style.indentRight ?? 0} 
                          onChange={(e) => {
                            const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                            const newSettings = {...templateSettings};
                            (newSettings[key as keyof TemplateSettings] as any).indentRight = isNaN(val) ? 0 : val;
                            setTemplateSettings(newSettings as TemplateSettings);
                          }}
                          className="w-full bg-input-bg border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 uppercase font-bold">Avanço 1ª Linha (mm)</label>
                        <input 
                          type="number" 
                          value={style.indentFirstLine ?? 0} 
                          onChange={(e) => {
                            const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                            const newSettings = {...templateSettings};
                            (newSettings[key as keyof TemplateSettings] as any).indentFirstLine = isNaN(val) ? 0 : val;
                            setTemplateSettings(newSettings as TemplateSettings);
                          }}
                          className="w-full bg-input-bg border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:ring-1 focus:ring-primary"
                        />
                      </div>

                      {/* Paragraph Spacing */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 uppercase font-bold">Antes (pt)</label>
                          <input 
                            type="number" 
                            value={style.spacingBefore ?? 0} 
                            onChange={(e) => {
                              const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                              const newSettings = {...templateSettings};
                              (newSettings[key as keyof TemplateSettings] as any).spacingBefore = isNaN(val) ? 0 : val;
                              setTemplateSettings(newSettings as TemplateSettings);
                            }}
                            className="w-full bg-input-bg border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:ring-1 focus:ring-primary"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 uppercase font-bold">Depois (pt)</label>
                          <input 
                            type="number" 
                            value={style.spacingAfter ?? 0} 
                            onChange={(e) => {
                              const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                              const newSettings = {...templateSettings};
                              (newSettings[key as keyof TemplateSettings] as any).spacingAfter = isNaN(val) ? 0 : val;
                              setTemplateSettings(newSettings as TemplateSettings);
                            }}
                            className="w-full bg-input-bg border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:ring-1 focus:ring-primary"
                          />
                        </div>
                      </div>

                      {/* Bold / Italic */}
                      <div className="flex items-center gap-6 pt-4 md:col-span-4 border-t border-slate-700 mt-2">
                        <label className="flex items-center gap-2 text-xs text-white cursor-pointer group">
                          <input 
                            type="checkbox" 
                            checked={style.bold} 
                            onChange={(e) => {
                              const newSettings = {...templateSettings};
                              (newSettings[key as keyof TemplateSettings] as any).bold = e.target.checked;
                              setTemplateSettings(newSettings as TemplateSettings);
                            }}
                            className="w-4 h-4 rounded border-slate-600 bg-input-bg text-primary focus:ring-primary"
                          /> 
                          <span className="group-hover:text-primary transition-colors">Negrito</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs text-white cursor-pointer group">
                          <input 
                            type="checkbox" 
                            checked={style.italics} 
                            onChange={(e) => {
                              const newSettings = {...templateSettings};
                              (newSettings[key as keyof TemplateSettings] as any).italics = e.target.checked;
                              setTemplateSettings(newSettings as TemplateSettings);
                            }}
                            className="w-4 h-4 rounded border-slate-600 bg-input-bg text-primary focus:ring-primary"
                          /> 
                          <span className="group-hover:text-primary transition-colors">Itálico</span>
                        </label>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-6 border-t border-slate-700 bg-slate-800/50 flex justify-end gap-3">
            <button 
              onClick={() => setShowSettings(false)}
              className="px-6 py-2 rounded font-bold text-slate-400 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button 
              onClick={saveTemplateSettings}
              className="px-6 py-2 rounded bg-primary hover:bg-primary-hover text-white font-bold shadow-lg shadow-primary/20 transition-all"
            >
              Guardar Configuração
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderApiKeyScreen = () => (
    <div className="flex flex-col items-center justify-center w-full animate-fade-in">
       <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Assistente de Acórdãos</h1>
          <p className="text-slate-400">Tribunal da Relação - Assistência Inteligente</p>
       </div>
       
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
      const togglePreview = (key: string) => {
        setPreviews(prev => ({ ...prev, [key]: !prev[key] }));
      };

      const toggleConclusionPreview = (idx: number) => {
        setPreviews((prev: any) => ({
          ...prev,
          conclusions: {
            ...(prev.conclusions || {}),
            [idx]: !prev.conclusions?.[idx]
          }
        }));
      };

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
             <div className="flex justify-between items-end px-1 pb-3 pt-2">
                <h3 className="text-white text-lg font-bold">I. Relatório</h3>
                <button
                  onClick={() => togglePreview('report')}
                  className="text-primary hover:text-primary-hover text-sm font-bold flex items-center gap-1 transition-colors"
                >
                  {previews.report ? <><Edit2 className="w-3 h-3" /> Editar</> : <><Eye className="w-3 h-3" /> Visualizar</>}
                </button>
             </div>
             <div className="bg-card-bg border border-slate-700 rounded-lg p-4 space-y-4">
                <div className="space-y-2">
                    <label className="text-xs text-slate-400 uppercase font-bold">Texto do Relatório</label>
                    {previews.report ? (
                       <div className="prose prose-sm prose-invert max-w-none bg-input-bg p-3 rounded min-h-[10rem]">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{caseData.report}</ReactMarkdown>
                       </div>
                    ) : (
                       <textarea
                         className="w-full h-40 bg-input-bg border-none rounded text-slate-200 text-sm focus:ring-1 focus:ring-primary resize-y placeholder-slate-500"
                         placeholder="Conteúdo do relatório..."
                         value={caseData.report}
                         onChange={(e) => setCaseData({...caseData, report: e.target.value})}
                       />
                    )}
                </div>
                
                <div className="space-y-2 pt-2 border-t border-slate-600">
                    <div className="flex justify-between items-end mb-1">
                       <label className="text-xs text-slate-400 uppercase font-bold">Decisão da 1ª Instância</label>
                       <button
                         onClick={() => togglePreview('decisionFirstInstance')}
                         className="text-primary hover:text-primary-hover text-[10px] font-bold flex items-center gap-1 transition-colors"
                       >
                         {previews.decisionFirstInstance ? <><Edit2 className="w-2.5 h-2.5" /> Editar</> : <><Eye className="w-2.5 h-2.5" /> Visualizar</>}
                       </button>
                    </div>
                    <p className="text-xs text-slate-500 italic mb-1">Será antecedida pela frase: "Foi proferida sentença que"</p>
                    {previews.decisionFirstInstance ? (
                       <div className="prose prose-sm prose-invert max-w-none bg-input-bg p-3 rounded min-h-[6rem]">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{caseData.decisionFirstInstance}</ReactMarkdown>
                       </div>
                    ) : (
                       <textarea
                         className="w-full h-24 bg-input-bg border-none rounded text-slate-200 text-sm focus:ring-1 focus:ring-primary resize-y placeholder-slate-500"
                         placeholder="Decisão da 1ª Instância..."
                         value={caseData.decisionFirstInstance}
                         onChange={(e) => setCaseData({...caseData, decisionFirstInstance: e.target.value})}
                       />
                    )}
                </div>
             </div>
          </section>

          {/* Conclusoes */}
          <section>
             <h3 className="text-white text-lg font-bold px-1 pb-3 pt-2">Conclusões dos Recursos (Fim do Relatório)</h3>
             <div className="space-y-4">
               {caseData.appealConclusions.map((ac, idx) => (
                 <div key={idx} className="bg-card-bg border border-slate-700 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-start border-b border-slate-600 pb-2">
                       <div className="flex items-center gap-3">
                          <span className="font-bold text-white text-sm">{ac.source}</span>
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${
                            ac.type === 'RECURSO' ? 'bg-primary/20 text-primary' : 'bg-orange-900/40 text-orange-400'
                          }`}>
                            {ac.type}
                          </span>
                       </div>
                       <button
                         onClick={() => toggleConclusionPreview(idx)}
                         className="text-primary hover:text-primary-hover text-xs font-bold flex items-center gap-1 transition-colors"
                       >
                         {previews.conclusions[idx] ? <><Edit2 className="w-3 h-3" /> Editar</> : <><Eye className="w-3 h-3" /> Visualizar</>}
                       </button>
                    </div>
                    {previews.conclusions[idx] ? (
                       <div className="prose prose-sm prose-invert max-w-none bg-input-bg p-3 rounded min-h-[12rem]">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{ac.content}</ReactMarkdown>
                       </div>
                    ) : (
                       <textarea
                         className="w-full h-48 bg-input-bg border-none rounded text-slate-200 text-sm focus:ring-1 focus:ring-primary resize-y"
                         value={ac.content}
                         onChange={(e) => {
                           const newConclusions = [...caseData.appealConclusions];
                           newConclusions[idx] = { ...ac, content: e.target.value };
                           setCaseData({ ...caseData, appealConclusions: newConclusions });
                         }}
                       />
                    )}
                 </div>
               ))}
             </div>
          </section>

          {/* II - Objeto do Recurso */}
          <section>
             <div className="flex justify-between items-end px-1 pb-3 pt-2">
                <h3 className="text-white text-lg font-bold">II. Objeto do Recurso (Questões a Decidir)</h3>
                <button
                  onClick={() => togglePreview('appealQuestions')}
                  className="text-primary hover:text-primary-hover text-sm font-bold flex items-center gap-1 transition-colors"
                >
                  {previews.appealQuestions ? <><Edit2 className="w-3 h-3" /> Editar</> : <><Eye className="w-3 h-3" /> Visualizar</>}
                </button>
             </div>
             <div className="bg-card-bg border border-slate-700 rounded-lg p-4">
                {previews.appealQuestions ? (
                   <div className="prose prose-sm prose-invert max-w-none bg-input-bg p-3 rounded min-h-[12rem]">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{caseData.appealQuestions}</ReactMarkdown>
                   </div>
                ) : (
                   <textarea
                     className="w-full h-48 bg-input-bg border-none rounded text-slate-200 text-sm focus:ring-1 focus:ring-primary resize-y"
                     placeholder="Questões suscitadas em cada recurso..."
                     value={caseData.appealQuestions}
                     onChange={(e) => setCaseData({...caseData, appealQuestions: e.target.value})}
                   />
                )}
             </div>
          </section>

          {/* III - Factos */}
          <section>
             <div className="flex justify-between items-end px-1 pb-3 pt-2">
                <h3 className="text-white text-lg font-bold">III. FUNDAMENTAÇÃO DE FACTO / FACTOS PROVADOS</h3>
                <button
                  onClick={() => togglePreview('provenFacts')}
                  className="text-primary hover:text-primary-hover text-sm font-bold flex items-center gap-1 transition-colors"
                >
                  {previews.provenFacts ? <><Edit2 className="w-3 h-3" /> Editar</> : <><Eye className="w-3 h-3" /> Visualizar</>}
                </button>
             </div>
             
             <div className="bg-card-bg border border-slate-700 rounded-lg p-4 min-h-[12rem]">
               {previews.provenFacts ? (
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

          {/* Factos Não Provados */}
          <section>
             <div className="flex justify-between items-end px-1 pb-3 pt-2">
                <h3 className="text-white text-lg font-bold">FACTOS NÃO PROVADOS</h3>
                <button
                  onClick={() => togglePreview('unprovenFacts')}
                  className="text-primary hover:text-primary-hover text-sm font-bold flex items-center gap-1 transition-colors"
                >
                  {previews.unprovenFacts ? <><Edit2 className="w-3 h-3" /> Editar</> : <><Eye className="w-3 h-3" /> Visualizar</>}
                </button>
             </div>
             
             <div className="bg-card-bg border border-slate-700 rounded-lg p-4 min-h-[8rem]">
               {previews.unprovenFacts ? (
                  <div className="prose prose-sm prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {caseData.unprovenFacts}
                    </ReactMarkdown>
                  </div>
               ) : (
                  <textarea
                    className="w-full h-48 bg-input-bg border-none rounded text-slate-200 text-sm focus:ring-1 focus:ring-primary resize-y"
                    value={caseData.unprovenFacts}
                    onChange={(e) => setCaseData({...caseData, unprovenFacts: e.target.value})}
                  />
               )}
             </div>
          </section>

          {/* Factos Impugnados */}
          <section>
             <div className="flex justify-between items-end px-1 pb-3 pt-2">
                <h3 className="text-white text-lg font-bold">Factos Impugnados</h3>
                <button
                  onClick={() => togglePreview('impugnedFacts')}
                  className="text-primary hover:text-primary-hover text-sm font-bold flex items-center gap-1 transition-colors"
                >
                  {previews.impugnedFacts ? <><Edit2 className="w-3 h-3" /> Editar</> : <><Eye className="w-3 h-3" /> Visualizar</>}
                </button>
             </div>
             
             <div className="bg-card-bg border border-slate-700 rounded-lg p-4 min-h-[8rem]">
               {previews.impugnedFacts ? (
                  <div className="prose prose-sm prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {caseData.impugnedFacts}
                    </ReactMarkdown>
                  </div>
               ) : (
                  <textarea
                    className="w-full h-48 bg-input-bg border-none rounded text-slate-200 text-sm focus:ring-1 focus:ring-primary resize-y"
                    value={caseData.impugnedFacts}
                    onChange={(e) => setCaseData({...caseData, impugnedFacts: e.target.value})}
                  />
               )}
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
        <div className="space-y-4">
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
                Download Word
              </button>
          </div>
          <button 
            onClick={handleExportJson}
            className="flex h-10 w-full items-center justify-center rounded border border-slate-600 text-slate-300 text-sm font-medium transition-colors hover:bg-slate-800 gap-2"
          >
            <Save className="w-4 h-4" />
            Guardar Projeto (JSON)
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
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
              Analisar Documentos
           </button>
        </div>
        
        <div className="flex justify-center">
          <label className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors cursor-pointer text-sm font-medium">
            <Upload className="w-4 h-4" />
            <span>Importar Projeto Guardado (JSON)</span>
            <input 
              type="file" 
              accept=".json" 
              className="hidden" 
              onChange={handleImportJson}
            />
          </label>
        </div>
      </div>
    );
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col font-sans bg-app-bg text-white selection:bg-primary selection:text-white">
      
      {/* Centered Header - Only show if API key is set */}
      {!showKeyInput && (
        <header className="flex flex-col items-center justify-center pt-8 pb-6 px-4 space-y-1 relative">
           <div className="absolute top-4 right-4 flex items-center gap-3">
             <button 
               onClick={() => setShowSettings(true)}
               title="Configurações de Modelo"
               className="text-slate-500 hover:text-primary transition-colors"
             >
               <RefreshCw className="w-5 h-5" />
             </button>
             <button 
               onClick={handleClearKey}
               title="Alterar Chave API"
               className="text-slate-500 hover:text-white transition-colors"
             >
               <LogOut className="w-5 h-5" />
             </button>
           </div>
           <h1 className="text-2xl md:text-3xl font-bold text-center leading-tight">
             Assistente de Elaboração de Acórdão
           </h1>
           <p className="text-slate-400 font-medium text-center text-sm md:text-base">
             Tribunal da Relação - Assistência Inteligente
           </p>
        </header>
      )}

      {/* Main Content */}
      <main className={`flex-grow p-4 w-full max-w-3xl mx-auto ${showKeyInput ? 'flex items-center justify-center' : ''}`}>
        {renderSettingsModal()}
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
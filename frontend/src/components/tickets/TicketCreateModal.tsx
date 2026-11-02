import React, { useState, useEffect, useRef } from 'react';
import { X, Zap, ImagePlus } from 'lucide-react';
import { TicketCategory, UserRole } from '../../types';
import { SlaPolicy } from '../../types';
import { useLanguage } from '../../traduction';

interface TicketCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRole?: UserRole;
  getCategorySLA: (category: TicketCategory) => Promise<SlaPolicy>;
  onCreate: (params: {
    title: string;
    description: string;
    category: TicketCategory;
    estimatedCost?: number;
    images?: File[];
  }) => Promise<unknown>;
}

export const TicketCreateModal: React.FC<TicketCreateModalProps> = ({
  isOpen,
  onClose,
  userRole = 'USER',
  getCategorySLA,
  onCreate,
}) => {
  const { t } = useLanguage();
  const isChefDeService = userRole === 'CHEF_DE_SERVICE';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TicketCategory>('HARDWARE');
  const [slaPolicy, setSlaPolicy] = useState<SlaPolicy | null>(null);
  const [slaError, setSlaError] = useState<string | null>(null);
  const [estimatedCost, setEstimatedCost] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setSlaPolicy(null);
    setSlaError(null);
    if (isOpen) {
      getCategorySLA(category)
        .then((policy) => {
          if (active) setSlaPolicy(policy);
        })
        .catch((error: unknown) => {
          if (active) setSlaError(error instanceof Error ? error.message : 'Le délai SLA ne peut pas être chargé.');
        });
    }
    return () => {
      active = false;
    };
  }, [category, getCategorySLA, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError('Veuillez renseigner un objet et une description claire.');
      return;
    }
    if (category === 'HARDWARE' && estimatedCost && (!/^\d+$/.test(estimatedCost) || !Number.isSafeInteger(Number(estimatedCost)))) {
      setError('Le coût doit être un nombre entier positif, sans virgule ni espace.');
      return;
    }

    try {
      await onCreate({
        title: title.trim(),
        description: description.trim(),
        category,
        estimatedCost: category === 'HARDWARE' && estimatedCost ? Number(estimatedCost) : undefined,
        images,
      });
      setTitle('');
      setDescription('');
      setEstimatedCost('');
      setImages([]);
      if (imageInputRef.current) imageInputRef.current.value = '';
      setError(null);
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'La création du ticket a échoué.');
    }
  };

  const handleImagesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []);
    const nextImages = [...images, ...selected];
    if (nextImages.length > 5) {
      setError(t('Cinq photos maximum par demande.'));
      event.target.value = '';
      return;
    }
    if (nextImages.some((image) =>
      image.size <= 0 ||
      image.size > 5 * 1024 * 1024 ||
      !['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(image.type)
    )) {
      setError(t('Choisissez des images JPEG, PNG, GIF ou WebP de 5 Mo maximum chacune.'));
      event.target.value = '';
      return;
    }
    setError(null);
    setImages(nextImages);
    event.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-lg bg-white border border-neutral-300 rounded-md shadow-sm overflow-hidden text-neutral-900 max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-200">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-neutral-900">
              {t(isChefDeService ? 'Nouvelle Demande Chef de Service' : 'Déclarer une Demande ou un Incident')}
            </h2>
            {isChefDeService && (
              <span className="font-mono text-[10px] bg-neutral-900 text-white px-2 py-0.5 rounded font-medium">
                PRIORITAIRE
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs overflow-y-auto">
          {isChefDeService && (
            <div className="p-3 bg-neutral-50 border border-neutral-200 rounded text-neutral-800 flex items-start gap-2.5">
              <Zap className="w-4 h-4 text-neutral-900 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-neutral-900 block">
                  {t('Traitement Prioritaire Automatique (Chef de Service)')}
                </span>
                <span className="text-[11px] text-neutral-600 block mt-0.5">
                  {t('Votre demande est automatiquement priorisée. Le délai maximum affiché est calculé par le système et ne peut pas être modifié.')}
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="p-2.5 rounded bg-neutral-100 border border-neutral-300 text-neutral-800">
              {error}
            </div>
          )}

          <div>
            <label className="block text-neutral-700 font-medium mb-1">
              {t('Objet de la demande')}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Remplacement écran station ou indisponibilité passerelle VPN..."
              className="w-full bg-white border border-neutral-300 rounded px-3 py-1.5 text-neutral-900 focus:outline-none focus:border-neutral-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-neutral-700 font-medium mb-1">
                {t('Catégorie')}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TicketCategory)}
                className="w-full bg-white border border-neutral-300 rounded px-3 py-1.5 text-neutral-900 focus:outline-none focus:border-neutral-500"
              >
                <option value="HARDWARE">{t('Matériel & Équipement')}</option>
                <option value="SOFTWARE">{t('Logiciels & Licences')}</option>
                <option value="NETWORK">{t('Réseau & VPN')}</option>
                <option value="ACCESS">{t('Droits & Comptes applicatifs')}</option>
                <option value="GENERAL">{t('Demande générale')}</option>
              </select>
            </div>

            <div>
              <label className="block text-neutral-700 font-medium mb-1">
                {t('Temps maximum de traitement')}
              </label>
              <div className="w-full bg-neutral-100 border border-neutral-300 rounded px-3 py-1.5 text-neutral-900 font-medium">
                {slaPolicy
                  ? `${slaPolicy.maxHours} ${t(slaPolicy.maxHours === 1 ? 'heure maximum' : 'heures maximum')}`
                  : t('Calcul du délai…')}
              </div>
              {slaError && <p role="alert" className="mt-1 text-[11px] text-rose-700">{slaError}</p>}
            </div>
          </div>

          {category === 'HARDWARE' && (
            <div className="p-3 bg-neutral-50 border border-neutral-200 rounded space-y-1.5">
              <label className="block text-neutral-700 font-medium">
                Coût estimé du matériel (en FCFA)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(e.target.value)}
                placeholder="Montant en chiffres uniquement"
                className="w-full bg-white border border-neutral-300 rounded px-3 py-1.5 text-neutral-900 font-mono text-xs"
              />
              <p className="text-[11px] text-neutral-500">
                {Number(estimatedCost) > 500000 ? (
                  <span className="text-amber-700">
                    Montant supérieur au plafond DSI (500 000 FCFA) : une approbation administrative préalable sera requise.
                  </span>
                ) : (
                  <span>
                    Plafond DSI : jusqu'à <strong>500 000 FCFA</strong>, la demande est traitée directement sans validation administrative.
                  </span>
                )}
              </p>
            </div>
          )}

          <div>
            <label className="block text-neutral-700 font-medium mb-1">
              {t("Description détaillée du besoin ou de l'incident")}
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Précisez le contexte opérationnel, les machines ou comptes impactés, les messages d'erreur rencontrés..."
              className="w-full bg-white border border-neutral-300 rounded px-3 py-1.5 text-neutral-900 focus:outline-none focus:border-neutral-500"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="ticket-images" className="block font-medium text-neutral-700">
              {t('Photos (facultatif)')}
            </label>
            <input
              ref={imageInputRef}
              id="ticket-images"
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              multiple
              onChange={handleImagesSelected}
              className="sr-only"
            />
            <label
              htmlFor="ticket-images"
              className="inline-flex cursor-pointer items-center gap-2 rounded border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-800 hover:bg-neutral-50"
            >
              <ImagePlus className="h-4 w-4" />
              {t('Ajouter des photos')}
            </label>
            <p className="text-[11px] text-neutral-500">
              {t('Jusqu’à 5 photos, 5 Mo chacune (JPEG, PNG, GIF ou WebP).')}
            </p>
            {images.length > 0 && (
              <ul className="space-y-1.5" aria-label={t('Photos jointes')}>
                {images.map((image, index) => (
                  <li key={`${image.name}-${image.lastModified}-${index}`} className="flex items-center justify-between gap-2 rounded border border-neutral-200 bg-neutral-50 px-3 py-2">
                    <span className="min-w-0 truncate text-neutral-700">{image.name} <span className="text-neutral-500">({(image.size / (1024 * 1024)).toFixed(1)} Mo)</span></span>
                    <button
                      type="button"
                      onClick={() => setImages((current) => current.filter((_, imageIndex) => imageIndex !== index))}
                      aria-label={`${t('Retirer')} ${image.name}`}
                      className="shrink-0 rounded p-1 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-neutral-600 hover:text-neutral-900 font-medium"
            >
              {t('Annuler')}
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded transition-colors"
            >
              {t(isChefDeService ? 'Soumettre en priorité urgente' : 'Soumettre la demande')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

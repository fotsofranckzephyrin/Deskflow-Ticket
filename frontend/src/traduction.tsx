import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type Language = 'fr' | 'en';

const translations: Record<Language, Record<string, string>> = {
  fr: {},
  en: {
    'DeskFlow': 'DeskFlow',
    "Plateforme d'Assistance Interne & Gestion des Services IT": 'Internal Support & IT Services Platform',
    'Connexion': 'Sign in',
    'Notifications': 'Notifications',
    'Tout marquer comme lu': 'Mark all as read',
    'Aucune notification.': 'No notifications.',
    'Impossible d’enregistrer les notifications sur cet appareil.': 'Unable to save notifications on this device.',
    'Vous devez terminer votre demande actuelle avant d’en prendre une autre.': 'You must finish your current request before taking another one.',
    'Prenez d’abord la demande prioritaire la plus ancienne de la file.': 'Take the oldest highest-priority request in the queue first.',
    'transition d’état de ticket invalide': 'Invalid ticket status transition.',
    "transition d'état de ticket invalide": 'Invalid ticket status transition.',
    'ce technicien traite déjà une demande non résolue': 'This technician already has an unresolved request.',
    'Référence :': 'Reference:',
    'Objet :': 'Subject:',
    'Description :': 'Description:',
    'Refuser la demande': 'Reject request',
    'Relance demandée par le demandeur.': 'Reopened by the requester.',
    'Relancez cette demande pour poursuivre le traitement sans créer un nouveau ticket.': 'Reopen this request to continue the work without creating a new ticket.',
    'Relancer cette demande': 'Reopen this request',
    'Résolution insatisfaisante ?': 'Not satisfied with the resolution?',
    'Seul un administrateur peut modifier le matricule.': 'Only an administrator can change the employee ID.',
    'Date création :': 'Created:',
    'Catégorie :': 'Category:',
    'Référence & suivi': 'Reference & tracking',
    'Réf & Urgence': 'Reference & urgency',
    'Temps max d’attente': 'Maximum wait time',
    'Demandeur & Direction': 'Requester & department',
    'Technicien assigné': 'Assigned technician',
    'Actions': 'Actions',
    'Détails →': 'Details →',
    'Prendre en charge': 'Take request',
    'Assigner à un technicien': 'Assign to a technician',
    'Sélectionner un agent': 'Select an agent',
    'Déjà sur une demande': 'Already handling a request',
    'Libre': 'Available',
    'Valider l’affectation': 'Confirm assignment',
    'Enregistrer la transition': 'Save status change',
    'Votre demande a été marquée comme résolue.': 'Your request has been marked as resolved.',
    "Si l'assistance est satisfaisante, confirmez la clôture.": 'If you are satisfied with the support, confirm closure.',
    'Confirmer la clôture': 'Confirm closure',
    'Clôturé par le demandeur': 'Closed by the requester',
    'Aucune demande trouvée': 'No requests found',
    'La file d’attente est vide ou aucun ticket ne correspond aux filtres appliqués.': 'The queue is empty or no tickets match the selected filters.',
    'Photos (facultatif)': 'Photos (optional)',
    'Ajouter des photos': 'Add photos',
    'Jusqu’à 5 photos, 5 Mo chacune (JPEG, PNG, GIF ou WebP).': 'Up to 5 photos, 5 MB each (JPEG, PNG, GIF or WebP).',
    'Photos jointes': 'Attached photos',
    'Retirer': 'Remove',
    'Cinq photos maximum par demande.': 'A maximum of five photos can be attached to a request.',
    'Choisissez des images JPEG, PNG, GIF ou WebP de 5 Mo maximum chacune.': 'Choose JPEG, PNG, GIF, or WebP images no larger than 5 MB each.',
    'Chargement…': 'Loading…',
    'Exporter le palmarès': 'Export leaderboard',
    'Votre demande a été résolue.': 'Your request has been resolved.',
    'Votre demande a été rejetée.': 'Your request has been rejected.',
    'Impossible de vérifier les mises à jour.': 'Unable to check for updates.',
    'Nouveau mot de passe personnel': 'New password',
    'Valider et Accéder à mon Espace': 'Confirm and open my workspace',
    'Créer un compte': 'Create an account',
    'Nom et Prénom': 'Full name',
    'Nom complet': 'Full name',
    'Adresse e-mail professionnelle': 'Work email address',
    'Adresse e-mail': 'Email address',
    'Email professionnel': 'Work email',
    'Mot de passe personnel': 'Password',
    'Département / Direction de rattachement': 'Department / Division',
    'Département / Direction': 'Department / Division',
    'Identifiant ou e-mail professionnel': 'Username or work email',
    'Mot de passe': 'Password',
    'Matricule agent / identifiant': 'Employee ID',
    'Se connecter': 'Sign in',
    'Créer mon compte': 'Create my account',
    'Envoyer le code': 'Send code',
    'Code reçu par e-mail': 'Code received by email',
    'Nouveau mot de passe': 'New password',
    'Réinitialiser le mot de passe': 'Reset password',
    'Retour à la connexion': 'Back to sign in',
    'Mes Demandes': 'My requests',
    "File d'Intervention Support": 'Support queue',
    'File Centrale & Priorités': 'Central queue & priorities',
    'Mes Assignations': 'My assignments',
    'Administration & Gouvernance': 'Administration & governance',
    'Console Supervision': 'Supervision console',
    'Déconnexion': 'Sign out',
    'Mon profil': 'My profile',
    'Nouvelle demande': 'New request',
    'En ligne · Synchronisé': 'Online · Synced',
    'Hors ligne': 'Offline',
    'Temps réel actif': 'Live',
    'Aucune demande': 'No requests',
    'Toutes les demandes': 'All requests',
    'Vue générale': 'Overview',
    'Gérer les départements': 'Manage departments',
    'Départements / directions': 'Departments / divisions',
    'Ajouter': 'Add',
    'Modifier': 'Edit',
    'Supprimer': 'Delete',
    'Enregistrer': 'Save',
    'Aucun département configuré.': 'No departments configured.',
    'Nom du département': 'Department name',
    'Le renommage est répercuté sur les comptes et les demandes. Un département utilisé ne peut pas être supprimé.': 'Renaming updates user accounts and requests. A department in use cannot be deleted.',
    'Suivi global des demandes': 'Global request tracking',
    'Tous les départements': 'All departments',
    'Tous les statuts': 'All statuses',
    'Tous les délais': 'All deadlines',
    'Résolues en retard': 'Resolved late',
    'Résolues dans les délais': 'Resolved on time',
    'En retard, non résolues': 'Overdue, unresolved',
    'Aucune demande ne correspond aux filtres.': 'No requests match these filters.',
    'Référence / création': 'Reference / created',
    'Demandeur / département': 'Requester / department',
    'Technicien': 'Technician',
    'Statut': 'Status',
    'Échéance / SLA': 'Deadline / SLA',
    'Demande urgente': 'Urgent request',
    'Nouveau ticket': 'New ticket',
    'Demandes du Service': 'Department requests',
    'Console de Supervision Support & Dispatching': 'Support supervision & dispatch console',
    "Suite d'Administration & Gouvernance IT": 'IT administration & governance suite',
    'Connexion Sécurisée': 'Secure sign in',
    'Créer un Compte': 'Create an account',
    'Matricule professionnel / Identifiant agent': 'Employee ID',
    'Votre espace DeskFlow': 'Your DeskFlow workspace',
    'Collaborateur': 'Employee',
    'Votre compte sera créé avec le profil': 'Your account will be created with the role',
    'Vous pourrez créer vos demandes et suivre leur traitement depuis votre espace.': 'You can create requests and track their progress from your workspace.',
    'Se connecter au portail': 'Sign in to the portal',
    'Créer mon compte professionnel': 'Create my account',
    'Mot de passe oublié ?': 'Forgot password?',
    'E-mail professionnel': 'Work email',
    'Recevoir un code par e-mail': 'Send a code by email',
    'Définir le nouveau mot de passe': 'Set a new password',
    'Objet de la demande': 'Request subject',
    'Catégorie': 'Category',
    'Temps maximum de traitement': 'Maximum resolution time',
    'heure maximum': 'hour maximum',
    'heures maximum': 'hours maximum',
    'Calcul du délai…': 'Calculating deadline…',
    'Description détaillée du besoin ou de l’incident': 'Detailed description of the request or incident',
    "Description détaillée du besoin ou de l'incident": 'Detailed description of the request or incident',
    'Annuler': 'Cancel',
    'Soumettre la demande': 'Submit request',
    'Soumettre en priorité urgente': 'Submit as urgent',
    'Matériel & Équipement': 'Hardware & equipment',
    'Logiciels & Licences': 'Software & licenses',
    'Réseau & VPN': 'Network & VPN',
    'Droits & Comptes applicatifs': 'Access & application accounts',
    'Demande générale': 'General request',
    'Mes Demandes d’Assistance': 'My support requests',
    "Mes Demandes d'Assistance": 'My support requests',
    'Demandes du Service & Priorités': 'Department requests & priorities',
    'Mes Interventions en Charge': 'My assigned interventions',
    'Supervision & Dispatching du Support': 'Support supervision & dispatch',
    'Toutes les Demandes de l’Entreprise': 'All company requests',
    "Toutes les Demandes de l'Entreprise": 'All company requests',
    'Suivi de vos demandes en cours. Vous visualisez l’état d’avancement de votre prise en charge.': 'Track your active requests and see their progress.',
    "Suivi de vos demandes en cours. Vous visualisez l'état d'avancement de votre prise en charge.": 'Track your active requests and see their progress.',
    'Exporter CSV': 'Export CSV',
    'Rechercher par objet, numéro, demandeur ou direction...': 'Search by subject, reference, requester or department...',
    'Tri : Date création': 'Sort: creation date',
    'Tri : Échéance la plus proche': 'Sort: nearest deadline',
    'Toutes les directions': 'All departments',
    'Tous statuts': 'All statuses',
    'En attente approbation': 'Awaiting approval',
    'En attente prise en charge': 'Awaiting assignment',
    'En attente de prise en charge': 'Awaiting assignment',
    'Assigné': 'Assigned',
    'En cours': 'In progress',
    'Résolu': 'Resolved',
    'Clôturé': 'Closed',
    'Refusé': 'Rejected',
    'Toutes priorités': 'All priorities',
    'Urgente': 'Urgent',
    'Haute': 'High',
    'Moyenne': 'Medium',
    'Basse': 'Low',
    'Vous n’avez actuellement aucune demande en cours.': 'You have no active requests.',
    "Vous n'avez actuellement aucune demande en cours.": 'You have no active requests.',
    'Aucune demande ne correspond à vos filtres.': 'No requests match your filters.',
    'Traité': 'Resolved',
    'Dépassé': 'Overdue',
    'Échéance :': 'Deadline:',
    'Délai max :': 'Max deadline:',
    'Reste': 'Remaining',
    'Modifier mes Informations Personnelles': 'Edit my personal information',
    'Vos informations ont été mises à jour avec succès !': 'Your information was updated successfully!',
    'Contactez un administrateur pour modifier votre rattachement.': 'Contact an administrator to change your department.',
    'Enregistrement…': 'Saving…',
    'Enregistrer les modifications': 'Save changes',
    "En attente d'approbation budget": 'Awaiting budget approval',
    "En attente d'approbation budgétaire": 'Awaiting budget approval',
    'Demande traitée (Résolue)': 'Request resolved',
    'Demande clôturée': 'Request closed',
    'Demande non retenue': 'Request rejected',
    "En file d'attente": 'Queued',
    'Assigné (À valider)': 'Assigned (awaiting acceptance)',
    'Assigné (En attente validation)': 'Assigned (awaiting acceptance)',
    'En cours de traitement': 'In progress',
    'En cours de traitement par le support': 'Being handled by support',
    'Demande résolue après l’échéance': 'Request resolved after the deadline',
    'Demande traitée dans les délais': 'Request resolved on time',
    'Délai dépassé de {duration}': 'Overdue by {duration}',
    "Reste moins d'une heure ({minutes} min)": 'Less than one hour remaining ({minutes} min)',
    'Reste environ {hours} heures': 'About {hours} hours remaining',
    'Chef de Service': 'Department manager',
    'Validation de la prise en charge': 'Assignment confirmation',
    'Statut : Assigné': 'Status: assigned',
    "Vous devez valider et accepter la demande pour démarrer l'intervention.": 'You must confirm and accept the request before starting work.',
    'Valider & Accepter la prise en charge': 'Confirm and accept assignment',
    'Statut de la demande': 'Request status',
    "Niveau d'urgence": 'Urgency level',
    'Demandeur': 'Requester',
    'Intervenant': 'Assigned technician',
    "En attente d'affectation": 'Awaiting assignment',
    "Temps max d'attente de traitement": 'Maximum resolution time',
    'Date de la demande': 'Request date',
    "Délai maximum d'attente": 'Maximum wait time',
    'État du traitement': 'Resolution status',
    'Réaffectation de la demande': 'Reassign request',
    'Transférer cette demande vers un collègue libre (non occupé sur une autre intervention).': 'Transfer this request to an available technician.',
    'Réaffecter au collègue libre': 'Reassign to available technician',
    'Description du besoin ou problème :': 'Request or issue description:',
    'Coût estimé :': 'Estimated cost:',
    'Le nom et l’e-mail sont obligatoires.': 'Name and email are required.',
    'Erreur lors de la mise à jour.': 'Unable to update your profile.',
    'Vous n’avez actuellement aucune demande en cours. Cliquez sur « Nouveau ticket » pour ouvrir une assistance.': 'You have no active requests. Select “New ticket” to request support.',
    'Accepter': 'Accept',
    'Réaffecter': 'Reassign',
    'Matériel :': 'Hardware:',
    'HARDWARE': 'Hardware',
    'SOFTWARE': 'Software',
    'NETWORK': 'Network',
    'ACCESS': 'Access',
    'GENERAL': 'General',
    "Temps max d'attente": 'Maximum wait time',
    'Note de traitement...': 'Processing note...',
    "Valider l'affectation": 'Confirm assignment',
    "Ce ticket n'est pas encore attribué.": 'This ticket has not been assigned yet.',
    'Mise à jour du statut': 'Update status',
    'Nouveau statut': 'New status',
    'Connexion interrompue :': 'Connection interrupted:',
    'Les actions nécessitent une connexion active au serveur DeskFlow.': 'Actions require an active connection to the DeskFlow server.',
    'Menu': 'Menu',
    'CHEF DE SERVICE': 'DEPARTMENT MANAGER',
    'CHEF DE SUPPORT': 'SUPPORT MANAGER',
    'TECHNICIEN': 'TECHNICIAN',
    'ADMINISTRATEUR': 'ADMINISTRATOR',
    'COLLABORATEUR': 'EMPLOYEE',
    "Décision d'arbitrage budgétaire": 'Budget decision',
    'Approuver le budget': 'Approve budget',
    'Échanges & Précisions': 'Messages & updates',
    'Aucun message pour le moment.': 'No messages yet.',
    'Rédiger un message ou apporter une précision...': 'Write a message or add details...',
    'Envoyer': 'Send',
    'Supprimer le ticket': 'Delete ticket',
    'Fermer': 'Close',
    'Connexion à DeskFlow…': 'Connecting to DeskFlow…',
  },
};

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (text: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function getInitialLanguage(): Language {
  try {
    const stored = localStorage.getItem('deskflow-language');
    if (stored === 'fr' || stored === 'en') return stored;
  } catch {
    // Continue with the browser language when storage is unavailable.
  }
  return navigator.language.toLowerCase().startsWith('en') ? 'en' : 'fr';
}

export const LanguageProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(getInitialLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
    try {
      localStorage.setItem('deskflow-language', language);
    } catch {
      // The selected language remains active for this session.
    }
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    t: (text) => translations[language][text] || text,
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
}

export const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage } = useLanguage();
  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-neutral-600">
      <span className="sr-only">Language</span>
      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value as Language)}
        aria-label="Language"
        className="rounded border border-neutral-300 bg-white px-2 py-1.5"
      >
        <option value="fr">Français</option>
        <option value="en">English</option>
      </select>
    </label>
  );
};

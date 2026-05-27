export const auth = {
  setupWizardKey: 'slimarr_setup_wizard_done',
  getToken: (): string | null => localStorage.getItem('token'),
  setToken: (token: string): void => localStorage.setItem('token', token),
  removeToken: (): void => localStorage.removeItem('token'),
  isLoggedIn: (): boolean => !!localStorage.getItem('token'),
  isSetupWizardDone: (): boolean => localStorage.getItem('slimarr_setup_wizard_done') === '1',
  markSetupWizardDone: (): void => localStorage.setItem('slimarr_setup_wizard_done', '1'),
}

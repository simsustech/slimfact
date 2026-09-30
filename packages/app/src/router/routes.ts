import type { RouteRecordRaw } from 'vue-router'
import { userRouteKey, redirectRouteKey } from '../oauth.js'

/**
 * `meta.lang` names the language section a route belongs to. It is the single
 * source for two things: the app-bar title and `document.title` (MainLayout's
 * watch). No `<h1>` is rendered: the toolbar already states the page title, so a
 * content heading duplicated it.
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/invoice/:uuid',
    component: () => import('../pages/InvoicePage.vue'),
    // Outside MainLayout, so `document.title` is not set from the map here: the
    // page owns its own title, and like every other route has no `<h1>`.
    meta: {
      lang: 'invoice'
    }
  },
  {
    path: '/',
    component: () => import('../layouts/MainLayout.vue'),
    children: [
      {
        path: '',
        component: () => import('../pages/IndexPage.vue'),
        meta: {
          lang: 'home'
        }
      },
      {
        path: 'redirect',
        name: redirectRouteKey,
        component: () => import('../pages/RedirectPage.vue')
      },
      {
        path: 'user',
        name: userRouteKey,
        component: () => import('../pages/UserPage.vue'),
        meta: {
          lang: 'user'
        }
      },
      {
        path: 'admin',
        children: [
          {
            path: '',
            component: () => import('../pages/AdminPage.vue'),
            meta: {
              lang: 'admin'
            }
          },
          {
            path: 'dashboard',
            component: () => import('../pages/admin/DashboardPage.vue'),
            meta: {
              lang: 'dashboard'
            }
          },
          {
            path: 'clients',
            components: {
              default: () =>
                import('../pages/admin/ClientsPage/ClientsPage.vue'),
              fabs: () =>
                import('../pages/admin/ClientsPage/ClientsPageFabs.vue')
            },
            meta: {
              lang: 'client'
            }
          },
          {
            path: 'invoices/:uuids*',
            components: {
              default: () =>
                import('../pages/admin/InvoicesPage/InvoicesPage.vue'),
              fabs: () =>
                import('../pages/admin/InvoicesPage/InvoicesPageFabs.vue')
            },
            meta: {
              lang: 'invoice'
            }
          },
          {
            path: 'subscriptions',
            components: {
              default: () =>
                import('../pages/admin/SubscriptionsPage/SubscriptionsPage.vue'),
              fabs: () =>
                import('../pages/admin/SubscriptionsPage/SubscriptionsPageFabs.vue')
            },
            meta: {
              lang: 'subscription'
            }
          },
          {
            path: 'receipts/:uuids*',
            component: () => import('../pages/admin/ReceiptsPage.vue'),
            meta: {
              lang: 'receipt'
            }
          },
          {
            path: 'bank',
            redirect: '/admin/payments'
          },
          {
            path: 'payments',
            component: () =>
              import('../pages/admin/PaymentsPage/PaymentsPage.vue'),
            meta: {
              lang: 'payment'
            }
          },
          {
            path: 'bills/:uuids*',
            components: {
              default: () => import('../pages/admin/BillsPage/BillsPage.vue'),
              fabs: () => import('../pages/admin/BillsPage/BillsPageFabs.vue')
            },
            meta: {
              lang: 'bill'
            }
          },
          {
            path: 'settings',
            children: [
              {
                path: '',
                component: () => import('../pages/admin/SettingsPage.vue'),
                meta: {
                  lang: 'configuration'
                }
              },
              {
                path: 'companies',
                components: {
                  default: () =>
                    import('../pages/admin/settings/CompaniesPage/CompaniesPage.vue'),
                  fabs: () =>
                    import('../pages/admin/settings/CompaniesPage/CompaniesPageFabs.vue')
                },
                meta: {
                  lang: 'company'
                }
              },
              {
                path: 'accounts',
                component: () =>
                  import('../pages/admin/settings/AccountsPage.vue'),
                meta: {
                  lang: 'account'
                }
              },
              {
                path: 'numberprefixes',
                components: {
                  default: () =>
                    import('../pages/admin/settings/NumberPrefixesPage/NumberPrefixesPage.vue'),
                  fabs: () =>
                    import('../pages/admin/settings/NumberPrefixesPage/NumberPrefixesPageFabs.vue')
                },
                meta: {
                  lang: 'numberPrefix'
                }
              },
              {
                path: 'initialnumberforprefixes',
                components: {
                  default: () =>
                    import('../pages/admin/settings/InitialNumberForPrefixesPage/InitialNumberForPrefixesPage.vue'),
                  fabs: () =>
                    import('../pages/admin/settings/InitialNumberForPrefixesPage/InitialNumberForPrefixesPageFabs.vue')
                },
                meta: {
                  lang: 'initialNumberForPrefix'
                }
              },
              {
                path: 'exports',
                component: () => import('../pages/admin/ExportsPage.vue'),
                meta: {
                  lang: 'exports'
                }
              },
              {
                path: 'banking',
                component: () =>
                  import('../pages/admin/BankPage/BankSettingsPage.vue'),
                meta: {
                  lang: 'banking'
                }
              }
            ]
          }
        ]
      },
      {
        path: 'account',
        children: [
          {
            path: '',
            component: () => import('../pages/AccountPage.vue'),
            meta: {
              lang: 'account'
            }
          },
          {
            path: 'bills',
            component: () => import('../pages/account/BillsPage.vue'),
            meta: {
              lang: 'bill'
            }
          },
          {
            path: 'receipts',
            component: () => import('../pages/account/ReceiptsPage.vue'),
            meta: {
              lang: 'receipt'
            }
          },
          {
            path: 'invoices',
            component: () => import('../pages/account/InvoicesPage.vue'),
            meta: {
              lang: 'invoice'
            }
          }
        ]
      },
      {
        path: 'checkout',
        component: () => import('../pages/CheckoutPage.vue'),
        // Inherited by the `success` child through the matched route records.
        meta: {
          lang: 'checkout'
        },
        children: [
          {
            path: 'success',
            component: () => import('../pages/checkout/SuccessPage.vue')
          }
        ]
      },
      {
        path: '/:catchAll(.*)*',
        component: () => import('../pages/Error404Page.vue')
      }
    ]
  }

  // Always leave this as last one,
  // but you can also remove it
]

export default routes

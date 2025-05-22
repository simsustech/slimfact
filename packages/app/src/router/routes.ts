import { RouteRecordRaw } from 'vue-router'
import { userRouteKey, redirectRouteKey } from '../oauth.js'
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('../layouts/MainLayout.vue'),
    children: [
      { path: '', component: () => import('../pages/IndexPage.vue') },
      {
        path: 'redirect',
        name: redirectRouteKey,
        component: () => import('../pages/RedirectPage.vue')
      },
      {
        path: 'user',
        name: userRouteKey,
        component: () => import('../pages/UserPage.vue')
      },
      {
        path: 'admin',
        children: [
          {
            path: '',
            component: () => import('../pages/AdminPage.vue')
          },
          {
            path: 'accounts',
            component: () => import('../pages/admin/AccountsPage.vue')
          },
          {
            path: 'companies',
            components: {
              default: () =>
                import('../pages/admin/CompaniesPage/CompaniesPage.vue'),
              fabs: () =>
                import('../pages/admin/CompaniesPage/CompaniesPageFabs.vue')
            }
          },
          {
            path: 'clients',
            components: {
              default: () =>
                import('../pages/admin/ClientsPage/ClientsPage.vue'),
              fabs: () =>
                import('../pages/admin/ClientsPage/ClientsPageFabs.vue')
            }
          },
          {
            path: 'invoices/:uuids*',
            components: {
              default: () =>
                import('../pages/admin/InvoicesPage/InvoicesPage.vue'),
              fabs: () =>
                import('../pages/admin/InvoicesPage/InvoicesPageFabs.vue')
            }
          },
          {
            path: 'subscriptions',
            components: {
              default: () =>
                import(
                  '../pages/admin/SubscriptionsPage/SubscriptionsPage.vue'
                ),
              fabs: () =>
                import(
                  '../pages/admin/SubscriptionsPage/SubscriptionsPageFabs.vue'
                )
            }
          },
          {
            path: 'receipts/:uuids*',
            component: () => import('../pages/admin/ReceiptsPage.vue')
          },
          {
            path: 'bills/:uuids*',
            components: {
              default: () => import('../pages/admin/BillsPage/BillsPage.vue'),
              fabs: () => import('../pages/admin/BillsPage/BillsPageFabs.vue')
            }
          }
        ]
      },
      {
        path: 'settings',
        children: [
          {
            path: '',
            component: () => import('../pages/SettingsPage.vue')
          },
          {
            path: 'accounts',
            component: () => import('../pages/settings/AccountsPage.vue')
          },
          {
            path: 'numberprefixes',
            component: () => import('../pages/settings/NumberPrefixesPage.vue')
          },
          {
            path: 'initialnumberforprefixes',
            component: () =>
              import('../pages/settings/InitialNumberForPrefixesPage.vue')
          },
          {
            path: 'exports',
            component: () => import('../pages/admin/ExportsPage.vue')
          }
        ]
      },
      {
        path: 'account',
        children: [
          {
            path: '',
            component: () => import('../pages/AccountPage.vue')
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
        children: [
          {
            path: 'success',
            component: () => import('../pages/checkout/SuccessPage.vue')
          }
        ]
      },
      {
        path: '/:catchAll(.*)*',
        component: () => import('src/pages/Error404Page.vue')
      }
    ]
  },
  {
    path: '/invoice/:uuid',
    component: () => import('../pages/InvoicePage.vue')
  }

  // Always leave this as last one,
  // but you can also remove it
]

export default routes

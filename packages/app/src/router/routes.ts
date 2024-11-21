import { RouteRecordRaw } from 'vue-router'
import { userRouteKey, redirectRouteKey } from '../oauth.js'
const routes: RouteRecordRaw[] = [
  {
    path: '/invoice/:uuid',
    component: () => import('../pages/InvoicePage.vue')
  },
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
        component: () => import('../pages/AdminPage.vue'),
        children: [
          {
            path: 'accounts',
            component: () => import('../pages/admin/AccountsPage.vue')
          },
          {
            path: 'companies',
            component: () => import('../pages/admin/CompaniesPage.vue')
          },
          {
            path: 'clients',
            component: () => import('../pages/admin/ClientsPage.vue')
          },
          {
            path: 'invoices/:uuids*',
            component: () => import('../pages/admin/InvoicesPage.vue')
          },
          {
            path: 'subscriptions',
            component: () => import('../pages/admin/SubscriptionsPage.vue')
          },
          {
            path: 'receipts',
            component: () => import('../pages/admin/ReceiptsPage.vue')
          },
          {
            path: 'bills',
            component: () => import('../pages/admin/BillsPage.vue')
          }
        ]
      },

      {
        path: 'settings',
        component: () => import('../pages/SettingsPage.vue'),
        children: [
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
          }
        ]
      },
      {
        path: 'employee',
        component: () => import('../pages/EmployeePage.vue'),
        children: []
      },
      {
        path: 'account',
        component: () => import('../pages/AccountPage.vue'),
        children: [
          {
            path: 'bills',
            component: () => import('../pages/account/BillsPage.vue')
          },
          {
            path: 'receipts',
            component: () => import('../pages/account/ReceiptsPage.vue')
          },
          {
            path: 'invoices',
            component: () => import('../pages/account/InvoicesPage.vue')
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
  }

  // Always leave this as last one,
  // but you can also remove it
]

export default routes

import Vue from 'vue'
import Router from 'vue-router'

Vue.use(Router)

export default new Router({
  routes: [
    {
      path: '/',
      name: 'tauon',
      component: require('@/components/Tauon').default
    },
    {
      path: '*',
      redirect: '/'
    }
  ]
})

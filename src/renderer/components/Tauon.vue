<template>
  <div id="layout">
    <div id="toolbar">
      <div>
        <Button :type="state[1]" @click="listenModal">{{ state[0] }}</Button>
        <Button type="default" @click="clearMsgs">Clear</Button>
      </div>
      <Input v-model="filter" style="width: 420px">
        <Select v-model="filterType" slot="prepend" style="width: 80px">
          <Option value="search" disabled>Search</Option>
          <Option value="filter">Filter</Option>
        </Select>
        <Button slot="append" icon="ios-search"></Button>
      </Input>
    </div>
    <div id="content" v-chat-scroll="{always: false}">
      <pre><span class="log" v-for="item in items" v-show="checkDisplay(item)" :style="item.style">{{ item.msg }}
</span></pre>
    </div>
    <Modal v-model="showListen" title="Listen" @on-ok="listen"
      @on-cancel="showListen=false">
      <Form :model="listenForm" :label-width="80">
        <FormItem label="Type">
            <Select v-model="listenForm.type" :rules="{required: true}">
                <Option value="dgram">UDP</Option>
                <Option value="serial" disabled>Serial</Option>
            </Select>
        </FormItem>
        <FormItem label="Port">
            <InputNumber :min="1024" :max="65535" v-model="listenForm.port"
              placeholder="Enter Port" clearable>
            </Input>
        </FormItem>
      </Form>
    </Modal>
    <Modal v-model="showMarkup">
    </Modal>
  </div>
</template>

<script>
  import {ipcRenderer} from 'electron'
  export default {
    name: 'Tauon',
    data () {
      return {
        showListen: false,
        showFilter: false,
        state: ['Listen', 'default'],
        items: [],
        patterns: [{pattern: /error/i, bgColor: 'red', color: 'white'}],
        listenForm: {
          port: 21999,
          type: 'dgram'
        },
        filter: '',
        filterType: 'filter'
      }
    },
    created () {
    },
    mounted () {
      ipcRenderer.on('listening', (evt, addr) => {
        this.state = ['Stop', 'primary']
      })
      ipcRenderer.on('message', (evt, msg, info) => {
        var msgs = msg.toString().split(/[\r\n]+/)
        var len = msgs.length
        var pLen = this.patterns.length
        for (var i = 0; i < len; i++) {
          var line = msgs[i]
          var color = null
          var bgColor = null
          for (var j = 0; j < pLen; j++) {
            var pattern = this.patterns[j]
            if (line.search(pattern.pattern) !== -1) {
              color = pattern.color
              bgColor = pattern.bgColor
              break
            }
          }
          var style = ''
          if (color) {
            style += 'color: ' + color + ';'
          }
          if (bgColor) {
            style += 'backgroundColor: ' + bgColor + ';'
          }
          this.items.push({msg: line, style: style})
        }
      })
      ipcRenderer.on('close', (evt) => {
        this.state = ['Listen', 'default']
      })
      ipcRenderer.on('error', (evt, err) => (
        this.$Modal.error({ title: 'Error', content: err })
      ))
    },
    beforeDestroy () {
      ipcRenderer.send('close')
      ipcRenderer.removeAllListeners('listening')
      ipcRenderer.removeAllListeners('message')
      ipcRenderer.removeAllListeners('close')
    },
    methods: {
      listenModal () {
        if (this.state[0] === 'Listen') {
          this.showListen = true
        } else {
          ipcRenderer.send('close')
        }
      },
      toggleScroll () {
        this.scroll = !this.scroll
      },
      listen () {
        ipcRenderer.send('listen', this.listenForm.input)
      },
      clearMsgs () {
        this.items = []
      },
      checkDisplay (it) {
        var display = true
        var filter = this.filter
        if (this.filterType === 'filter' && filter &&
            it.msg.search(filter) === -1) {
          display = false
        }
        return display
      }
      /*
      open (link) {
        this.$electron.shell.openExternal(link)
      }, */
    }
  }
</script>

<style>
pre {
  margin: 0px;
}
#content {
  height: calc(100vh - 42px);
  overflow-y: scroll;
}
#toolbar {
  display: flex;
  justify-content: space-between;
  height: 42px;
  padding: 4px;
  background-color: #f7f7f7;
}
#toolbar>* {
  box-sizing: border-box;
}
.log {
  padding: 2px;
  font-family: monospace;
}
</style>

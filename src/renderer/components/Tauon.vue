<template>
  <div id="layout">
    <div id="toolbar">
      <div>
        <Button :type="state[1]" @click="listenModal">{{ state[0] }}</Button>
        <Button type="default" @click="showColorForm">Colors</Button>
        <Button :type="autoScroll?'primary':'default'"
            @click="toggleAutoScroll">Auto Scroll</Button>
      </div>
      <Input v-model="filter" style="width: 420px">
        <Select v-model="filterType" slot="prepend" style="width: 80px">
          <Option value="search" disabled>Search</Option>
          <Option value="filter">Filter</Option>
        </Select>
        <Button slot="append" icon="ios-search"></Button>
      </Input>
    </div>
    <Tabs type="card" closable @on-click="tabChange" @on-tab-remove="tabRemove">
      <TabPane v-for="tab in tabs" :key="tab" :name="tab" :label="tab">
          <pre class="content" :id="'log' + tab"></pre>
      </TabPane>
    </Tabs>
    <Modal v-model="showListen" title="Listen" @on-ok="listen"
      @on-cancel="showListen=false">
      <Form :model="listenForm" :label-width="80">
        <FormItem label="Type">
          <Select v-model="listenForm.type" :rules="{required: true}">
            <Option value="dgram">UDP</Option>
            <Option value="serial">Serial</Option>
          </Select>
        </FormItem>
        <FormItem v-show="listenForm.type == 'dgram'" label="Port">
            <InputNumber :min="1024" :max="65535" v-model="listenForm.port"
              placeholder="Enter Port" clearable>
            </InputNumber>
        </FormItem>
        <FormItem v-show="listenForm.type == 'serial'" label="Device">
            <Input v-model="listenForm.dev" placeholder="Enter Device"
              clearable>
            </Input>
        </FormItem>
        <FormItem v-show="listenForm.type == 'serial'" label="Baud rate">
          <Select v-model="listenForm.rate">
            <Option value="1200">1200</Option>
            <Option value="2400">2400</Option>
            <Option value="4800">4800</Option>
            <Option value="9600">9600</Option>
            <Option value="1920">19200</Option>
            <Option value="38400">38400</Option>
            <Option value="57600">57600</Option>
            <Option value="115200">115200</Option>
          </Select>
        </FormItem>
      </Form>
    </Modal>
    <Modal v-model="showColors" title="Colored pattern">
      <Row type="flex" justify="space-between" :gutter="5">
        <Col span="9">Pattern</Col>
        <Col span="5">Text</Col>
        <Col span="5">Background</Col>
        <Col span="5"></Col>
      </Row>
      <Form>
        <FormItem v-for="(item, index) in colorForm.patterns" :key="index">
          <Row type="flex" justify="space-between" :gutter="5">
            <Col span="9">
              <Input type="text" v-model="item.pattern"
                  placeholder="Enter pattern..."></Input>
            </Col>
            <Col span="5">
              <ColorPicker v-model="item.color" alpha recommend />
            </Col>
            <Col span="5">
              <ColorPicker v-model="item.bgColor" alpha recommend />
            </Col>
            <Col span="5">
              <Button type="ghost" @click="colorRemove(index)"
                  icon="close-round">Delete</Button>
            </Col>
          </Row>
        </FormItem>
        <FormItem>
          <Row>
            <Col span="12">
              <Button type="dashed" long @click="colorAdd"
                  icon="plus-round">Add item</Button>
            </Col>
          </Row>
        </FormItem>
      </Form>
      <div slot="footer"><Button type="success" @click="saveConfig"
          long>Save</Button></div>
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
        showColors: false,
        state: ['Listen', 'default'],
        buffer: '',
        currentTab: '',
        tabs: [],
        patterns: [
          {pattern: 'Error', color: 'red', bgColor: ''},
          {pattern: 'error', color: 'red', bgColor: ''}
        ],
        listenForm: {
          port: 21999,
          type: 'dgram',
          rate: '115200'
        },
        colorForm: {
          patterns: []
        },
        filter: '',
        filterType: 'filter',
        filterTimer: null,
        autoScroll: true
      }
    },
    mounted () {
      ipcRenderer.on('config', (evt, cfg) => {
        var newStyles = []

        this.patterns = cfg
        for (var i = 0; i < this.tabs.length; i++) {
          var logElements = document.getElementById('log' + this.tabs[i]).children
          var len = logElements.length

          for (var j = 0; j < len; j++) {
            var elem = logElements[j]
            var oldStyle = elem.getAttribute('style')
            var newStyle = this.getStyle(elem.innerText)
            if (oldStyle !== newStyle) {
              newStyles.push([elem, newStyle])
            }
          }
        }

        for (i = 0; i < newStyles.length; i++) {
          var pair = newStyles[i]
          pair[0].setAttribute('style', pair[1])
        }
      })
      ipcRenderer.on('listening', (evt, addr) => {
        var type = this.listenForm.type === 'dgram' ? 'UDP' : 'Serial'
        this.$Message.success({
          content: 'Listening on ' + type + ' Port ' + addr.port,
          duration: 3
        })
        this.state = ['Stop', 'primary']
      })
      ipcRenderer.on('message', (evt, msg, info) => {
        var msgStr = msg.toString()
        var addr = info.address.replace(/^::ffff:/, '')

        if (this.getTab(addr) !== -1) {
          this.addMessage(msgStr, addr)
        } else {
          this.tabs.push(addr)
          // add message to new tab after DOM update
          this.$nextTick(() => {
            this.addMessage(msgStr, addr)
          })
        }
      })
      ipcRenderer.on('close', (evt) => {
        this.$Message.info({content: 'Closed', duration: 3})
        this.state = ['Listen', 'default']
      })
      ipcRenderer.on('error', (evt, err) => (
        this.$Modal.error({ title: 'Error', content: err })
      ))
      ipcRenderer.send('readConfig')
      this.checkScroll()
    },
    watch: {
      filter (pattern) {
        if (this.filterTimer !== null) {
          clearTimeout(this.filterTimer)
        }
        this.filterTimer = setTimeout(() => {
          this.updateFilter(pattern, this.currentTab)
        }, 500)
      }
    },
    beforeDestroy () {
      ipcRenderer.send('close')
      ipcRenderer.removeAllListeners('listening')
      ipcRenderer.removeAllListeners('message')
      ipcRenderer.removeAllListeners('close')
    },
    methods: {
      checkScroll (time) {
        var cTab = this.currentTab
        if (cTab.length !== 0) {
          var logContainer = document.getElementById('log' + cTab)
          if (logContainer.scrollTop + logContainer.offsetHeight !==
              logContainer.scrollHeight) {
            logContainer.scrollTop = logContainer.scrollHeight
          }
        }
        if (this.autoScroll) {
          window.requestAnimationFrame(this.checkScroll)
        }
      },
      toggleAutoScroll () {
        this.autoScroll = !this.autoScroll
        if (this.autoScroll) {
          this.checkScroll(0)
        }
      },
      addMessage (msg, addr) {
        // prepend previous received part
        if (this.buffer.length > 0) {
          msg = this.buffer + msg
          this.buffer = ''
        }

        // messages will be displayed line by line
        var msgs = msg.split(/\r?\n/)
        var len = msgs.length - 1

        // detect partly received messages
        if (msgs[len].length > 0) {
          this.buffer = msgs[len]
        }

        if (this.currentTab.length === 0) {
          this.currentTab = addr
        }

        var logFragment = document.createDocumentFragment()
        for (var i = 0; i < len; i++) {
          var line = msgs[i]
          var style = this.getStyle(line)
          var logElement = document.createElement('span')
          var logText = document.createTextNode(line + '\n')

          if (style.length > 0) {
            logElement.setAttribute('style', style)
          }
          logElement.setAttribute('class', 'log')
          logElement.appendChild(logText)
          logFragment.appendChild(logElement)
        }
        var logContainer = document.getElementById('log' + addr)
        logContainer.appendChild(logFragment)
      },
      getTab (addr) {
        var idx = -1
        for (var i = 0; i < this.tabs.length; i++) {
          if (this.tabs[i] === addr) {
            idx = i
            break
          }
        }
        return idx
      },
      listenModal () {
        if (this.state[0] === 'Listen') {
          this.showListen = true
        } else {
          ipcRenderer.send('close')
        }
      },
      listen () {
        if (this.listenForm.type === 'dgram') {
          ipcRenderer.send('listenDgram', this.listenForm.port)
        } else {
          ipcRenderer.send('listenSerial', this.listenForm.dev,
            parseInt(this.listenForm.rate))
        }
      },
      clearMsgs () {
        var logContainer = document.getElementById('log')
        var child = logContainer.firstChild

        while (child) {
          logContainer.removeChild(child)
          child = logContainer.firstChild
        }
      },
      updateFilter (pattern, addr) {
        if (addr.length !== 0) {
          var logElements = document.getElementById('log' + addr).children
          var len = logElements.length
          var regPattern = new RegExp(pattern)
          var newStyles = []

          for (var i = 0; i < len; i++) {
            var elem = logElements[i]
            var show = pattern.length === 0 ||
                this.checkDisplay(regPattern, elem.innerText)
            var style = this.parseStyle(elem.getAttribute('style'))

            if (show) {
              delete style['display']
            } else if (style['display'] !== 'none') {
              style['display'] = 'none'
            }
            newStyles[i] = this.generateStyle(style)
            /*
            if (Object.keys(style).length > 0) {
              elem.setAttribute('style', this.generateStyle(style))
            } else {
              elem.removeAttribute('style')
            } */
          }

          // apply all style changes at once (avoid layout thrashing)
          for (i = 0; i < len; i++) {
            logElements[i].setAttribute('style', newStyles[i])
          }
        }
      },
      getStyle (line) {
        var pLen = this.patterns.length
        var style = []
        for (var j = 0; j < pLen; j++) {
          var pattern = this.patterns[j]
          if (line.search(pattern.pattern) !== -1) {
            if (pattern.color.length > 0) {
              style['color'] = pattern.color
            }
            if (pattern.bgColor.length > 0) {
              style['background-color'] = pattern.bgColor
            }
            break
          }
        }

        if (this.filter.length !== 0 && !this.checkDisplay(this.filter, line)) {
          style['display'] = 'none'
        }

        return this.generateStyle(style)
      },
      checkDisplay (filter, line) {
        return !(this.filterType === 'filter' && line.search(filter) === -1)
      },
      parseStyle (style) {
        var obj = []
        if (style) {
          var styles = style.split(';')
          for (var i = 0; i < styles.length; i++) {
            var pair = styles[i].split(':')
            if (pair.length === 2) {
              obj[pair[0]] = pair[1]
            }
          }
        }
        return obj
      },
      generateStyle (obj) {
        var style = ''
        var keys = Object.keys(obj)
        for (var i = 0; i < keys.length; i++) {
          var key = keys[i]
          style += key + ':' + obj[key] + ';'
        }
        return style
      },
      showColorForm () {
        this.colorForm.patterns = this.patterns.slice(0)
        this.showColors = true
      },
      colorAdd () {
        this.colorForm.patterns.push({'pattern': '', color: '', bgColor: ''})
      },
      colorRemove (idx) {
        this.colorForm.patterns.splice(idx, 1)
      },
      saveConfig () {
        ipcRenderer.send('writeConfig', this.colorForm.patterns)
        this.showColors = false
      },
      tabRemove (addr) {
        this.tabs.splice(this.getTab(addr), 1)
      },
      tabChange (addr) {
        if (addr !== this.currentTab) {
          if (this.filter.length !== 0) {
            if (this.currentTab.length !== 0) {
              this.updateFilter('', this.currentTab)
            }
            this.updateFilter(this.filter, addr)
          }
          this.currentTab = addr
        }
      }
    }
  }
</script>

<style>
pre {
  color: #000;
  margin: 0px;
  white-space: pre-wrap;
  word-wrap: break-word;
}
.content {
  height: calc(100vh - 90px);
  overflow-y: scroll;
  padding: 5px;
}
#toolbar {
  display: flex;
  justify-content: space-between;
  height: 42px;
  padding: 4px;
  background-color: #ccc;
}
#toolbar>* {
  box-sizing: border-box;
}
.log {
  padding: 2px;
  font-family: monospace;
}
</style>

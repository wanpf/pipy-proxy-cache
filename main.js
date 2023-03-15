((
  
  config = JSON.decode(pipy.load('config.json')),

  pageCache = new algo.Cache(null, null, { ttl: config.proxy_cache_ttl }),

) => pipy({
  _reqTime: null,
  _reqHead: null,
  _resTime: null,
  _resHead: null,
  _clientIP: null,
  _shoted: false,
  _path: undefined,
  _resMessage: null,
})

.listen(config.port)
.demuxHTTP().to(
  $=>$
  .handleMessageStart(
    msg => (
      _clientIP = __inbound.remoteAddress,
      _reqTime = (new Date()).toISOString(),
      _reqHead = msg.head,
      _shoted = Boolean(_resMessage = pageCache.get(msg?.head?.path)),
      !_shoted && (
        _path = msg.head.path,
        msg.head.headers['host'] = config.proxy_upstream.domain
      )
    )
  )
  .branch(
    () => !_shoted, (
      $=>$.muxHTTP().to(
        $=>$.branch(
          () => config.proxy_upstream.scheme === 'https', (
            $=>$.connectTLS({ sni: config.proxy_upstream.domain }).to('proxy')
          ), (
            $=>$.link('proxy')
          )
        )
      ).handleMessage(
        msg => (
          msg?.head?.status >= '200' && msg?.head?.status <= '299' && (
            pageCache.set(_path, _resMessage = msg)
          )
        )
      )
    ), (
      $=>$.replaceMessage(
        () => _resMessage
      )
    )
  )
  .handleMessageStart(
    msg => (
      _resTime = (new Date()).toISOString(),
      _resHead = msg.head
    )    
  )
  .handleMessageEnd(
    () => (
      console.log(JSON.stringify(
        {
          clientIP: _clientIP,          
          reqTime: _reqTime,
          req: _reqHead,
          resTime: _resTime,
          res: _resHead,          
          endTime: (new Date()).toISOString(),
          size: _resMessage?.body?.size,
          shoted: _shoted
        },
      null, 4))
    )
  )
)

.pipeline('proxy')
.connect(config.proxy_upstream.domain + ':' + config.proxy_upstream.port)

)()
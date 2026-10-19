const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto')
const root=path.resolve(__dirname,'..'),covers=JSON.parse(fs.readFileSync(path.join(root,'static/scenic-lzx/catalog.json'),'utf8'))
function helper(){const c={covers};vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(root,'common/scenic-images.js'),'utf8').replace(/^import .*$/gm,'').replace(/export /g,'')+'\nglobalThis.api={applyLzxScenicImages,lzxScenicInterceptor}',c);return c.api}
test('all 16 LZX photographs are bundled unchanged and use App static URLs',()=>{
 assert.equal(Object.keys(covers).length,16)
 for(const entry of Object.values(covers)){assert.match(entry.path,/^\/static\/scenic-lzx\/[a-z-]+\.jpg$/);const bytes=fs.readFileSync(path.join(root,entry.path));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),entry.sha256)}
})
test('nested scenic results use LZX photos while user uploads, guides and other cities retain their assets',()=>{
 const h=helper(),result={data:{spot_list:[{spot_name:'昆明湖',city:'北京',image_path:'old.jpg'},{spot_name:'长廊',city:'苏州',image_path:'suzhou.jpg'}],current_spot_info:{spot_name:'玉带桥',image_path:''},guide_info:{name:'guide',avatar:'guide.png'},messages:[{image:'user-photo.jpg'}]}}
 h.applyLzxScenicImages(result);assert.equal(result.data.spot_list[0].image_path,covers['昆明湖'].path);assert.equal(result.data.current_spot_info.image_path,covers['玉带桥'].path);assert.equal(result.data.spot_list[1].image_path,'suzhou.jpg');assert.equal(result.data.guide_info.avatar,'guide.png');assert.equal(result.data.messages[0].image,'user-photo.jpg')
})
test('the App request interceptor transforms response data without touching status or headers',()=>{
 const response={statusCode:200,header:{example:'header'},data:{spot_name:'石舫',city:'北京',image_path:'old.jpg'}};helper().lzxScenicInterceptor.success(response);assert.equal(response.data.image_path,covers['石舫'].path);assert.equal(response.statusCode,200);assert.equal(response.header.example,'header')
})
test('route cards and details use an LZX scenic cover instead of an old generated illustration',()=>{
 const route={route_id:8,city:'北京',spot_names:['石舫','昆明湖'],cover_image:'old-generated.jpg',cover_generated:true};helper().applyLzxScenicImages(route);assert.equal(route.cover_image,covers['石舫'].path);assert.equal(route.cover_generated,false)
})

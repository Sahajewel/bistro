const express = require("express")
const app = express()
const cors = require("cors")
const port = process.env.PORT || 5000
const jwt = require("jsonwebtoken")
const { MongoClient, ServerApiVersion,  ObjectId } = require('mongodb');
const stripe = require("stripe")("sk_test_51QezvXHJ5p1yGLHo5i1hyL0s1NZQ5SbX81BlrDxPbRmpNADpyP4r893Uv42M66s8ioqpLDuUlBz1mN2Kvk4rWxQH00QQvaFJHK")
require('dotenv').config()
app.use(cors())
app.use(express.json())


// const { decode } = require("punycode")
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.r7awt.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
const userCollection= client.db("bistroProjects").collection("users")
const menuCollection= client.db("bistroProjects").collection("menu")
const reviewCollection= client.db("bistroProjects").collection("reviews")
const cartCollection= client.db("bistroProjects").collection("Carts")
const historyCollection= client.db("bistroProjects").collection("history")
// json web token

app.post("/jwt", (req, res)=>{
  const user = req.body;
  const token = jwt.sign(user,process.env.ACCESS_TOKEN_SECRET,{expiresIn:"1h"})
  
 res.send({token})
})


  const verifyToken=(req, res, next)=>{
    console.log(req.headers.authorization)
    if(!req.headers.authorization){
      
      return res.status(401).send({message: "unauthorized Access"})
    }
    const token = req.headers.authorization.split(" ")[1]
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded)=>{
      if(err){
        return res.status(401).send({message: "unauthorized access"})
      }
      req.decoded= decoded
      next()
    })
    console.log(req.headers)
  
  }
  const verifyAdmin = async(req, res, next)=>{
    const email = req.decoded.email;
    const query = {email: email}
    const user = await userCollection.findOne(query)
    const isAdmin = user?.role === "admin";
    if(!isAdmin){
      return res.status(403).send({message: "forbidden access"})
    }
    next()
  }


  app.get("/menu", async(req,res)=>{
    const sort = req.query.sort
    console.log(sort)
      const result =await menuCollection.find().sort({price:sort}).toArray()
      res.send(result)
  })

  app.post("/menu",verifyToken, verifyToken, async (req, res)=>{
    const data = req.body;
    const result= await menuCollection.insertOne(data)
    res.send(result)
  })
app.get("/menu/:id", async (req, res)=>{
  const id = req.params.id;
  const cursor = {_id: new ObjectId(id)};
  const result = await menuCollection.findOne(cursor)
  res.send(result)

})
  app.patch("/update/:id", async(req, res)=>{
    const menu= req.body
    const id = req.params.id;
    const cursor = {_id: new ObjectId(id)};
    const updateDoc={
      $set:{
        name: menu.name,
        price: menu.price,
        category: menu.category,
        recipe: menu.recipe,
        image: menu.image
      }
    }
    const result = await menuCollection.updateOne(cursor,updateDoc)
    res.send(result)
  })
  app.delete("/menu/:id",verifyToken, verifyAdmin, async(req, res)=>{
    const id= req.params.id
    const cursor = {_id: new ObjectId(id)}
    const result = await menuCollection.deleteOne(cursor)
    res.send(result)
  })
  app.get("/reviews", async(req,res)=>{
      const result =await reviewCollection.find().toArray()
      res.send(result)
  })

  
  

  app.post("/users", async(req, res)=>{
    const user = req.body;
  
    const query = {email: user.email}
    const existingUser = await userCollection.findOne(query)
    if(existingUser){
      return res.send({message: "User already exist"})
    }
    const result = await userCollection.insertOne(user)
    res.send(result)
  })

  app.get("/users",verifyToken,verifyAdmin, async(req, res)=>{
    const result = await userCollection.find().toArray()
    res.send(result)
  })


  app.get("/users/admin/:email",verifyToken, async(req, res)=>{
    const email = req.params.email
    if(email !== req?.decoded?.email){
      return res.status(403).send({message: "forbidden access"})
    }
    const query ={email: email}
    const user = await userCollection.findOne(query)
    let admin = false
    if(user){
      admin = user?.role === "admin"
    }
    res.send(admin)
  })

  app.patch("/users/admin/:id",verifyToken, verifyAdmin, async(req, res)=>{
    const id = req.params.id
    const filter = {_id: new ObjectId(id)}
    const updateDoc={
      $set:{
        role: "admin"
      }
    }
    const result = await userCollection.updateOne(filter, updateDoc)
    res.send(result)
  })


  app.delete("/users/:id",verifyToken, verifyAdmin, async(req, res)=>{
    const id = req.params.id
    const query = {_id: new ObjectId(id)}
    const result = await userCollection.deleteOne(query)
    res.send(result)
  })
    // cart collection 
app.get("/carts", async(req,res)=>{
  const email = req.query.email;
  const query = {email: email}
  const result = await cartCollection.find(query).toArray()
  res.send(result)
})
    app.post("/carts", async(req, res)=>{
      const cart = req.body;
      const result = await cartCollection.insertOne(cart)
      res.send(result)
    })

    app.delete("/carts/:id", async(req, res)=>{
      const id = req.params.id;
      const result = await cartCollection.deleteOne({_id: new ObjectId(id)})
      res.send(result)
    })

    // stripe secret
    app.post("/create-checkout-session", async(req, res)=>{
      const {price} = req.body;
      const amount = parseInt(price * 100)
      console.log(amount, "inside amount")
      const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: [
            "card"
          ]
      })
      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })

    app.post("/payments", async (req,res)=>{
      const payment = req.body
      const historyResult = await historyCollection.insertOne(payment)
     const query = {_id: {
      $in: payment.cartId.map(id=> new ObjectId(id))
     }}
     const deleteResult = await cartCollection.deleteMany(query)
        res.send({historyResult, deleteResult})
    })
    app.get("/payments/:email",verifyToken, async (req, res)=>{
      const query= {email:req.params.email};
      if(req.params?.email !== req.decoded?.email){
        return res.status(403).send({message: "Forbidden"})
      }
      const result = await historyCollection.find(query).toArray()
      res.send(result)
    })

    app.get("/admin-stats",verifyToken, verifyAdmin, async (req, res)=>{
      const customer = await userCollection.estimatedDocumentCount();
      const orders = await historyCollection.estimatedDocumentCount();
      const products = await menuCollection.estimatedDocumentCount();
      // const payments = await historyCollection.find().toArray();
      // const revenue = payments.reduce((total, current)=>total + current.price, 0)
      const result =await  historyCollection.aggregate([
        {
          $group: {
            _id: null,
            totalPrice: {$sum: "$price"}
          }
        }
      ]).toArray()
      const revenue = result.length > 0 ? result[0].totalPrice : 0
      res.send({
        customer,
        orders,
        products,
        revenue
      })
    })

    app.get("/ordered-stats",verifyToken, verifyAdmin, async(req, res)=>{
      const result = await historyCollection.aggregate([
          {
            $unwind: "$menuItem"
          }, {
            $lookup: {
              from: "menu",
              localField: "menuItem",
              foreignField: "_id",
              as: "menuItem"
            }
          },
          {
            $unwind: "$menuItem"
          },
          {
           $group:{
            _id: "$menuItem.category",
            quantity: { $sum : 1},
            revenue: { $sum: "$menuItem.price"}
           }
          }, {
            $project:{
              _id: 0,
              category: "$_id",
              quantity: "$quantity",
              revenue: "$revenue"
            }
          }
      ]).toArray()
      res.send(result)
    })
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get("/", (req,res)=>{
    res.send("Bistro Projects")
})
app.listen(port,()=>{
    console.log(`Port is running on:${port}`)
})
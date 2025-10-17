import { useState } from "react"
import axios from 'axios'
import process from 'process'

export default function HomePage() {
    const [img, setImg] = useState(null)
    const [imgUrl, setImgUrl] = useState("");
    const[preview, setPreview] = useState(null)
    const [matches, setMatches] = useState([])

    const [error, setError] = useState(null)
    const [loading, setLoading] = useState(false)

    const backendUrl = import.meta.env.VITE_BACKEND_URL;

    const handleImageChange = (e) => {
        const file = e.target.files[0]
        if (file) {
            setImg(file)
            setPreview(URL.createObjectURL(file))
            setError(null)
            console.log(file)
        }
    }
    
    const handleUrlInput = (e) => {
      const url = e.target.value
      if (url &&  url.startsWith("http://") || url.startsWith("https://")) {
        setImgUrl(url)
        setPreview(url)
        setImg(null)
        setError(null)
      }
    }

    const handleRemove = () => {
        setImg(null)
        setPreview(null)
        setMatches([])
    }

    const matchProduct = async () => {
      if (!img && imgUrl.trim() === "") {
        setError("Please upload an image or enter a valid image URL first.");
        return;
      }
      setLoading(true)
      const formData = new FormData()
      
      if (img) {
        formData.append("image", img);
      } else {
        formData.append("imageUrl", imgUrl); // Send URL instead of file
      }

        try {
          const { data } = await axios.post(`${backendUrl}/api/matches`,
            formData,
            {
              headers: { "Content-Type": "multipart/form-data"}
            }
          )
          setMatches(data)
          setError(null)
          console.log(data)
        } catch (err) {
          console.error(err)
          setError("Failed to fetch matches")
        } finally {
          setLoading(false)
        }
    }

  return (
    <div>
      <h1>Visual Product Matcher</h1>
      <div>
        <div>
        <label for="input-file">Upload Image</label>
        <input type="file" accept="image/*" id="input-file" onChange={handleImageChange} style={{display: 'none'}}/>
        <p>OR</p>
        <input type="text" placeholder="Paste image URL" onChange={handleUrlInput}/> <br /><br />
        
        {error && <p style={{color: "red"}}>{error}</p>}
        </div>

        {preview && 
          <div>
          <img src={preview} width={200} alt="Preview"/> <br />
          <button onClick={matchProduct} disabled={loading}>{loading ? "Matching..." : "MATCH"}</button>
          <button onClick={handleRemove} style={{marginTop: "10px", marginLeft:"10px"}}>Remove</button>
          
          <br /><br />
          </div>
      }
      </div>

      <ul style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "20px",
        padding: 0,
        listStyleType: "none"
      }}>
        {matches.map((match, index) => (
          <li key={index}>
            <ul style={{
              listStyleType: "none",
              border: "1px solid #ccc",
              borderRadius: "10px",
              padding: "10px",
              textAlign: "center"
            }}>
              <li><img src={match.image_url} style={{
                maxWidth: "100%",
                height: "auto",
                height: "150px",
                objectFit: "cover",
                marginBottom: "10px"
              }} alt={match.name} /></li>
              <li style={{fontFamily: "monospace"}}>{index+1}. {match.name}</li>
              <li style={{fontFamily: "monospace"}}>Category: {match.category}</li>
              <li style={{fontFamily: "monospace"}}>Similarity: {match.similarity}</li>
            </ul>
          </li>
        ))}
      </ul>
    </div>
  )
}

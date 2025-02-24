import React from "react";

const ImageDisplay = ({ data }) => {
  return (
    <>
      <img
        src={data.image_data_uri}
        alt=""
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
        }}
      />
    </>
  );
};

export default ImageDisplay;

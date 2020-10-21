package com.rasterfoundry.datamodel

import io.circe.{Decoder, Encoder}

case class AsyncJobErrors(value: List[String])

object AsyncJobErrors {
  implicit val decAsyncJobErrors
    : Decoder[AsyncJobErrors] = Decoder[List[String]] map {
    AsyncJobErrors.apply
  }
  implicit val encAsyncJobErrors: Encoder[AsyncJobErrors] =
    Encoder[List[String]].contramap(_.value)
}

sealed abstract class AsyncJobStatus(val repr: String) {
  override def toString = repr
}

object AsyncJobStatus {
  case object Accepted extends AsyncJobStatus("ACCEPTED")
  case object Failed extends AsyncJobStatus("FAILED")
  case object Succeeded extends AsyncJobStatus("SUCCEEDED")

  def fromStringE(s: String): Either[String, AsyncJobStatus] =
    s.toLowerCase() match {
      case "accepted"  => Right(Accepted)
      case "failed"    => Right(Failed)
      case "succeeded" => Right(Succeeded)
      case _           => Left(s"Unrecognized async job status: $s")
    }

  implicit val decAsyncJobStatus: Decoder[AsyncJobStatus] =
    Decoder[String].emap(fromStringE)

  implicit val encAsyncJobStatus: Encoder[AsyncJobStatus] =
    Encoder[String].contramap(_.repr)
}